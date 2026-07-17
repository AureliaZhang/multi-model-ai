/**
 * MCP (Model Context Protocol) Client Service
 * 
 * Communicates with MCP servers via JSON-RPC 2.0 over HTTP/SSE.
 * Supports tools/list for tool discovery and tools/call for execution.
 */

import { getDb } from '../database';
import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

/**
 * Send a JSON-RPC 2.0 request to an MCP server endpoint.
 */
async function sendJsonRpc(
  url: string,
  method: string,
  params?: Record<string, unknown>,
  timeoutMs: number = 30000
): Promise<unknown> {
  const request: JsonRpcRequest = {
    jsonrpc: '2.0',
    id: 1,
    method,
    ...(params ? { params } : {}),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`MCP server returned HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';

    // Handle SSE response (some MCP servers use SSE for responses)
    if (contentType.includes('text/event-stream')) {
      return await parseSSEResponse(response);
    }

    // Handle JSON response
    const data = await response.json() as JsonRpcResponse;
    if (data.error) {
      throw new Error(`MCP error ${data.error.code}: ${data.error.message}`);
    }
    return data.result;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parse an SSE response to extract the JSON-RPC result.
 */
async function parseSSEResponse(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6)) as JsonRpcResponse;
          if (data.error) {
            throw new Error(`MCP error ${data.error.code}: ${data.error.message}`);
          }
          if (data.result !== undefined) {
            return data.result;
          }
        } catch (e) {
          // Skip invalid JSON lines
        }
      }
    }
  }

  throw new Error('No result received from SSE stream');
}

/**
 * Connect to an MCP server and discover its tools.
 * Updates the database with discovered tools.
 */
export async function connectAndDiscoverTools(serverId: string): Promise<McpToolDefinition[]> {
  const db = getDb();
  const server = db.prepare('SELECT * FROM mcp_servers WHERE id = ?').get(serverId) as any;
  if (!server) throw new Error('MCP server not found');

  try {
    // Send initialize request first
    await sendJsonRpc(server.url, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'multi-model-ai-platform', version: '1.0.0' },
    });

    // Send initialized notification (no response expected, but some servers need it)
    try {
      await sendJsonRpc(server.url, 'notifications/initialized');
    } catch {
      // Notification may not need a response
    }

    // Discover tools
    const result = await sendJsonRpc(server.url, 'tools/list') as { tools?: McpToolDefinition[] };
    const tools = result?.tools || [];

    // Clear old tools and save new ones
    db.prepare('DELETE FROM mcp_tools WHERE server_id = ?').run(serverId);

    for (const tool of tools) {
      db.prepare(
        'INSERT INTO mcp_tools (id, server_id, name, description, input_schema, enabled) VALUES (?, ?, ?, ?, ?, 1)'
      ).run(
        uuidv4(),
        serverId,
        tool.name,
        tool.description || null,
        JSON.stringify(tool.inputSchema || {})
      );
    }

    // Update server status
    db.prepare(
      "UPDATE mcp_servers SET status = 'connected', last_connected = ?, updated_at = ? WHERE id = ?"
    ).run(new Date().toISOString(), new Date().toISOString(), serverId);

    return tools;
  } catch (err: unknown) {
    // Mark server as error
    db.prepare(
      "UPDATE mcp_servers SET status = 'error', updated_at = ? WHERE id = ?"
    ).run(new Date().toISOString(), serverId);
    throw err;
  }
}

/**
 * Execute a tool call on an MCP server.
 */
export async function executeToolCall(
  serverId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const db = getDb();
  const server = db.prepare('SELECT * FROM mcp_servers WHERE id = ?').get(serverId) as any;
  if (!server) throw new Error('MCP server not found');

  const result = await sendJsonRpc(server.url, 'tools/call', {
    name: toolName,
    arguments: args,
  });

  return result;
}

/**
 * Load all enabled MCP tools from the database, formatted for OpenAI function calling.
 * Returns tools in the OpenAI tools format.
 */
export function loadEnabledMcpTools(db: Database.Database): Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}> {
  const rows = db.prepare(`
    SELECT mt.name, mt.description, mt.input_schema, mt.server_id
    FROM mcp_tools mt
    JOIN mcp_servers ms ON mt.server_id = ms.id
    WHERE mt.enabled = 1 AND ms.enabled = 1 AND ms.status = 'connected'
  `).all() as any[];

  return rows.map((row: any) => ({
    type: 'function' as const,
    function: {
      name: `mcp_${row.server_id.substring(0, 8)}_${row.name}`,
      description: row.description || `MCP tool: ${row.name}`,
      parameters: JSON.parse(row.input_schema || '{}'),
    },
  }));
}

/**
 * Resolve an MCP tool call from the AI back to the server and tool name.
 * Tool names are prefixed with `mcp_{serverId8}_` to identify the source.
 */
export function resolveToolCall(functionName: string): { serverId: string; toolName: string } | null {
  const db = getDb();
  const match = functionName.match(/^mcp_([a-f0-9]+)_(.+)$/);
  if (!match) return null;

  const serverIdPrefix = match[1];
  const toolName = match[2];

  // Find the server by ID prefix
  const servers = db.prepare('SELECT id FROM mcp_servers WHERE enabled = 1').all() as any[];
  for (const s of servers) {
    if (s.id.startsWith(serverIdPrefix)) {
      return { serverId: s.id, toolName };
    }
  }

  return null;
}
