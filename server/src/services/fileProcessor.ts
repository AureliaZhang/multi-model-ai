/**
 * File Processor Service
 * 
 * Handles text extraction, chunking, and embedding for uploaded files.
 * Used by the File Library feature for RAG-based chat.
 */

import fs from 'fs';
import path from 'path';
import { getDb } from '../database';
import { generateEmbedding, serializeEmbedding, cosineSimilarity } from './embeddings';
import { getErrorMessage } from '../utils/errors';
import type { FileChunkSearchRow } from '../dbRows';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number }>;
const { v4: uuidv4 } = require('uuid');

// Chunking configuration
const CHUNK_SIZE = 1000;      // ~1000 characters per chunk
const CHUNK_OVERLAP = 200;    // 200 character overlap between chunks

/**
 * Extract text from a file on disk.
 * Supports PDF, text, code, CSV, JSON, etc.
 */
export async function extractTextFromFile(filePath: string, mimeType: string, filename: string): Promise<string | null> {
  try {
    if (mimeType === 'application/pdf') {
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text || null;
    }

    // Text-based files
    if (
      mimeType.startsWith('text/') ||
      mimeType === 'application/json' ||
      mimeType === 'application/xml' ||
      mimeType === 'application/javascript' ||
      mimeType === 'application/x-javascript' ||
      mimeType === 'application/typescript' ||
      mimeType === 'application/csv' ||
      mimeType === 'application/x-yaml' ||
      mimeType === 'application/yaml' ||
      mimeType === 'application/toml' ||
      mimeType === 'application/x-sh' ||
      mimeType === 'application/octet-stream'
    ) {
      const text = fs.readFileSync(filePath, 'utf-8');
      // Check if binary (>10% non-printable)
      const nonPrintable = text.replace(/[\x09\x0A\x0D\x20-\x7E\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/g, '');
      if (nonPrintable.length > text.length * 0.1) {
        return null;
      }
      return text;
    }

    // Fallback: check by extension
    const textExtensions = ['.txt', '.md', '.csv', '.json', '.xml', '.html', '.htm', '.css', '.js', '.ts', '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.rs', '.go', '.rb', '.php', '.sh', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.log', '.sql', '.r', '.lua', '.swift', '.kt', '.scala', '.vue', '.svelte', '.jsx', '.tsx'];
    const lowerFilename = filename.toLowerCase();
    if (textExtensions.some(ext => lowerFilename.endsWith(ext))) {
      const text = fs.readFileSync(filePath, 'utf-8');
      const nonPrintable = text.replace(/[\x09\x0A\x0D\x20-\x7E\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/g, '');
      if (nonPrintable.length > text.length * 0.1) {
        return null;
      }
      return text;
    }

    return null;
  } catch (err: unknown) {
    console.error(`[fileProcessor] Error extracting text from ${filename}:`, getErrorMessage(err));
    return null;
  }
}

/**
 * Split text into overlapping chunks.
 * Prefers splitting at paragraph boundaries, then sentence boundaries, then word boundaries.
 */
export function chunkText(text: string): string[] {
  if (text.length <= CHUNK_SIZE) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + CHUNK_SIZE;

    if (end >= text.length) {
      // Last chunk
      chunks.push(text.substring(start));
      break;
    }

    // Try to find a good split point
    let splitPoint = -1;

    // 1. Try paragraph boundary (\n\n) within the last 30% of the chunk
    const paragraphSearch = text.lastIndexOf('\n\n', end);
    if (paragraphSearch > start + CHUNK_SIZE * 0.7) {
      splitPoint = paragraphSearch + 2; // Include the newlines in the current chunk
    }

    // 2. Try sentence boundary (. ) within the last 20%
    if (splitPoint === -1) {
      const sentenceSearch = text.lastIndexOf('. ', end);
      if (sentenceSearch > start + CHUNK_SIZE * 0.8) {
        splitPoint = sentenceSearch + 2;
      }
    }

    // 3. Try newline boundary
    if (splitPoint === -1) {
      const newlineSearch = text.lastIndexOf('\n', end);
      if (newlineSearch > start + CHUNK_SIZE * 0.7) {
        splitPoint = newlineSearch + 1;
      }
    }

    // 4. Try word boundary (space)
    if (splitPoint === -1) {
      const spaceSearch = text.lastIndexOf(' ', end);
      if (spaceSearch > start + CHUNK_SIZE * 0.5) {
        splitPoint = spaceSearch + 1;
      }
    }

    // 5. Hard split if no good boundary found
    if (splitPoint === -1) {
      splitPoint = end;
    }

    chunks.push(text.substring(start, splitPoint));

    // Next chunk starts with overlap
    start = splitPoint - CHUNK_OVERLAP;
    if (start < 0) start = 0;
    // Avoid infinite loop: ensure we advance at least 1 character
    if (start >= splitPoint) {
      start = splitPoint;
    }
  }

  return chunks.filter(c => c.trim().length > 0);
}

/**
 * Process a file: extract text → chunk → embed → store in DB.
 * Runs asynchronously (fire-and-forget from the upload handler).
 */
export async function processFile(fileId: string, filePath: string, mimeType: string, filename: string): Promise<void> {
  const db = getDb();

  try {
    console.log(`[fileProcessor] Processing file: ${filename} (${fileId})`);

    // 1. Extract text
    const text = await extractTextFromFile(filePath, mimeType, filename);
    if (!text || text.trim().length === 0) {
      db.prepare(`UPDATE file_library SET status = 'error', error_message = ?, updated_at = ? WHERE id = ?`)
        .run('Could not extract text from file (unsupported format or binary content)', new Date().toISOString(), fileId);
      console.warn(`[fileProcessor] No text extracted from ${filename}`);
      return;
    }

    // 2. Chunk the text
    const chunks = chunkText(text);
    console.log(`[fileProcessor] ${filename}: ${chunks.length} chunks (${text.length} chars total)`);

    // 3. Generate embeddings and store chunks
    const insertChunk = db.prepare(`
      INSERT INTO file_chunks (id, file_id, chunk_index, content, embedding, token_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();

    for (let i = 0; i < chunks.length; i++) {
      const chunkContent = chunks[i];
      const chunkId = uuidv4();

      // Generate embedding
      let embeddingStr: string | null = null;
      try {
        const embedding = await generateEmbedding(chunkContent);
        embeddingStr = serializeEmbedding(embedding);
      } catch (err: unknown) {
        console.warn(`[fileProcessor] Embedding failed for chunk ${i} of ${filename}: ${getErrorMessage(err)}`);
      }

      // Rough token count estimate (~4 chars per token for English, ~2 for Chinese)
      const asciiChars = chunkContent.match(/[\x00-\x7F]/g)?.length || 0;
      const nonAsciiChars = chunkContent.length - asciiChars;
      const tokenCount = Math.ceil(asciiChars / 4 + nonAsciiChars / 2);

      insertChunk.run(chunkId, fileId, i, chunkContent, embeddingStr, tokenCount, now);
    }

    // 4. Update file status to ready
    db.prepare(`UPDATE file_library SET status = 'ready', chunk_count = ?, updated_at = ? WHERE id = ?`)
      .run(chunks.length, new Date().toISOString(), fileId);

    console.log(`[fileProcessor] ✓ File ${filename} processed: ${chunks.length} chunks`);

  } catch (err: unknown) {
    console.error(`[fileProcessor] Error processing file ${filename}:`, getErrorMessage(err));
    db.prepare(`UPDATE file_library SET status = 'error', error_message = ?, updated_at = ? WHERE id = ?`)
      .run(getErrorMessage(err) || 'Unknown processing error', new Date().toISOString(), fileId);
  }
}

/**
 * Search file chunks by vector similarity.
 * Returns the most relevant chunks across specified files.
 */
export function searchFileChunks(
  queryEmbedding: number[],
  fileIds: string[],
  limit: number = 5,
  threshold: number = 0.2
): { chunkId: string; fileId: string; fileName: string; content: string; similarity: number }[] {
  const db = getDb();

  if (fileIds.length === 0) return [];

  // Build placeholders for IN clause
  const placeholders = fileIds.map(() => '?').join(',');

  const rows = db.prepare(`
    SELECT fc.id as chunk_id, fc.file_id, fc.content, fc.embedding, fl.original_name
    FROM file_chunks fc
    JOIN file_library fl ON fc.file_id = fl.id
    WHERE fc.file_id IN (${placeholders}) AND fc.embedding IS NOT NULL AND fc.embedding != ''
  `).all(...fileIds) as FileChunkSearchRow[];

  if (rows.length === 0) return [];

  const scored: { chunkId: string; fileId: string; fileName: string; content: string; similarity: number }[] = [];

  for (const row of rows) {
    try {
      const entryEmbedding = JSON.parse(row.embedding || '[]') as number[];
      const similarity = cosineSimilarity(queryEmbedding, entryEmbedding);

      if (similarity >= threshold) {
        scored.push({
          chunkId: row.chunk_id,
          fileId: row.file_id,
          fileName: row.original_name,
          content: row.content,
          similarity,
        });
      }
    } catch {
      // Skip invalid embeddings
    }
  }

  // Sort by similarity descending
  scored.sort((a, b) => b.similarity - a.similarity);

  return scored.slice(0, limit);
}
