/**
 * MCP Server CRUD Routes
 * 
 * GET    /api/mcp/servers          - List all MCP servers
 * POST   /api/mcp/servers          - Create a new MCP server
 * PUT    /api/mcp/servers/:id      - Update an MCP server
 * DELETE /api/mcp/servers/:id      - Delete an MCP server
 * POST   /api/mcp/servers/:id/connect - Connect & discover tools
 * GET    /api/mcp/servers/:id/tools  - List tools for a server
 * PUT    /api/mcp/tools/:id/toggle   - Enable/disable a tool
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { connectAndDiscoverTools } from '../services/mcpClient';
import { requireAuth, requireRole } from '../middleware/auth';
import type { AuthRequest, McpServer, McpTool } from '../types';
import { getErrorMessage } from '../utils/errors';

const router = Router();

// All MCP routes require admin auth
router.use(requireAuth);
router.use(requireRole('admin'));

// GET /api/mcp/servers - List all MCP servers with tool counts
router.get('/servers', (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT ms.*, COUNT(mt.id) as tool_count
      FROM mcp_servers ms
      LEFT JOIN mcp_tools mt ON mt.server_id = ms.id
      GROUP BY ms.id
      ORDER BY ms.created_at DESC
    `).all() as any[];

    const servers: (McpServer & { toolCount: number })[] = rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      description: r.description,
      enabled: Boolean(r.enabled),
      status: r.status,
      lastConnected: r.last_connected,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      toolCount: r.tool_count,
    }));

    res.json({ success: true, data: servers });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// POST /api/mcp/servers - Create a new MCP server
router.post('/servers', (req: AuthRequest, res: Response) => {
  try {
    const { name, url, description } = req.body;
    if (!name || !url) {
      return res.status(400).json({ success: false, error: 'name and url are required' });
    }

    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(
      'INSERT INTO mcp_servers (id, name, url, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, name, url, description || null, now, now);

    const server = db.prepare('SELECT * FROM mcp_servers WHERE id = ?').get(id) as any;
    res.status(201).json({
      success: true,
      data: {
        id: server.id,
        name: server.name,
        url: server.url,
        description: server.description,
        enabled: Boolean(server.enabled),
        status: server.status,
        lastConnected: server.last_connected,
        createdAt: server.created_at,
        updatedAt: server.updated_at,
        toolCount: 0,
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// PUT /api/mcp/servers/:id - Update an MCP server
router.put('/servers/:id', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, url, description, enabled } = req.body;
    const db = getDb();

    const existing = db.prepare('SELECT * FROM mcp_servers WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'MCP server not found' });
    }

    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (url !== undefined) { updates.push('url = ?'); values.push(url); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (enabled !== undefined) { updates.push('enabled = ?'); values.push(enabled ? 1 : 0); }
    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.prepare(`UPDATE mcp_servers SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const server = db.prepare(`
      SELECT ms.*, COUNT(mt.id) as tool_count
      FROM mcp_servers ms
      LEFT JOIN mcp_tools mt ON mt.server_id = ms.id
      WHERE ms.id = ?
      GROUP BY ms.id
    `).get(id) as any;

    res.json({
      success: true,
      data: {
        id: server.id,
        name: server.name,
        url: server.url,
        description: server.description,
        enabled: Boolean(server.enabled),
        status: server.status,
        lastConnected: server.last_connected,
        createdAt: server.created_at,
        updatedAt: server.updated_at,
        toolCount: server.tool_count,
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// DELETE /api/mcp/servers/:id - Delete an MCP server
router.delete('/servers/:id', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const result = db.prepare('DELETE FROM mcp_servers WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'MCP server not found' });
    }

    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// POST /api/mcp/servers/:id/connect - Connect to server and discover tools
router.post('/servers/:id/connect', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const existing = db.prepare('SELECT * FROM mcp_servers WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'MCP server not found' });
    }

    const tools = await connectAndDiscoverTools(id);

    res.json({
      success: true,
      data: {
        toolsCount: tools.length,
        tools: tools.map(t => ({ name: t.name, description: t.description })),
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// GET /api/mcp/servers/:id/tools - List tools for a server
router.get('/servers/:id/tools', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const rows = db.prepare(
      'SELECT * FROM mcp_tools WHERE server_id = ? ORDER BY name'
    ).all(id) as any[];

    const tools: McpTool[] = rows.map((r: any) => ({
      id: r.id,
      serverId: r.server_id,
      name: r.name,
      description: r.description,
      inputSchema: JSON.parse(r.input_schema || '{}'),
      enabled: Boolean(r.enabled),
      createdAt: r.created_at,
    }));

    res.json({ success: true, data: tools });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// PUT /api/mcp/tools/:id/toggle - Enable/disable a tool
router.put('/tools/:id/toggle', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    const db = getDb();

    const result = db.prepare('UPDATE mcp_tools SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'MCP tool not found' });
    }

    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

export default router;
