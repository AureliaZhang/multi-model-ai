import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { processFile, searchFileChunks } from '../services/fileProcessor';
import { generateEmbedding } from '../services/embeddings';
import { requireAuth } from '../middleware/auth';
import type { AuthRequest } from '../types';
import type { FileLibraryEntry } from '../types';

const router = Router();

// Ensure uploads directory exists
const UPLOADS_DIR = process.env.UPLOADS_PATH || path.join(__dirname, '..', '..', 'data', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const storedName = `${uuidv4()}${ext}`;
    cb(null, storedName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB per file
  },
});

/**
 * GET /api/files
 * List all files in the library
 */
router.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const rows = db.prepare(`
      SELECT * FROM file_library
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset) as any[];

    const countRow = db.prepare('SELECT COUNT(*) as total FROM file_library').get() as any;

    const files: FileLibraryEntry[] = rows.map(rowToFile);

    res.json({
      success: true,
      data: {
        files,
        total: countRow.total,
        page,
        limit,
        totalPages: Math.ceil(countRow.total / limit),
      },
    });
  } catch (err: any) {
    console.error('[files] Error listing files:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/files/:id
 * Get single file details
 */
router.get('/:id', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM file_library WHERE id = ?').get(req.params.id) as any;
    if (!row) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    res.json({ success: true, data: rowToFile(row) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/files/:id/chunks
 * Get chunks for a file (paginated)
 */
router.get('/:id/chunks', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const rows = db.prepare(`
      SELECT id, file_id, chunk_index, content, token_count, created_at
      FROM file_chunks
      WHERE file_id = ?
      ORDER BY chunk_index ASC
      LIMIT ? OFFSET ?
    `).all(req.params.id, limit, offset) as any[];

    const countRow = db.prepare('SELECT COUNT(*) as total FROM file_chunks WHERE file_id = ?').get(req.params.id) as any;

    res.json({
      success: true,
      data: {
        chunks: rows,
        total: countRow.total,
        page,
        limit,
        totalPages: Math.ceil(countRow.total / limit),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/files/upload
 * Upload one or more files
 */
router.post('/upload', requireAuth, upload.array('files', 20), async (req: AuthRequest, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    const db = getDb();
    const now = new Date().toISOString();
    const insertStmt = db.prepare(`
      INSERT INTO file_library (id, original_name, stored_name, mime_type, file_size, status, uploaded_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'processing', ?, ?, ?)
    `);

    const results: FileLibraryEntry[] = [];

    for (const file of files) {
      const fileId = uuidv4();
      const mimeType = file.mimetype || 'application/octet-stream';
      // Fix filename encoding: multer may deliver non-ASCII filenames as latin1
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

      insertStmt.run(fileId, originalName, file.filename, mimeType, file.size, req.user?.id || null, now, now);

      results.push({
        id: fileId,
        originalName,
        storedName: file.filename,
        mimeType,
        fileSize: file.size,
        chunkCount: 0,
        status: 'processing',
        errorMessage: null,
        uploadedBy: req.user?.id || null,
        createdAt: now,
        updatedAt: now,
      });

      // Process file asynchronously (don't await - fire and forget)
      const filePath = path.join(UPLOADS_DIR, file.filename);
      processFile(fileId, filePath, mimeType, originalName).catch(err => {
        console.error(`[files] Background processing failed for ${originalName}:`, err.message);
      });
    }

    res.json({ success: true, data: results });
  } catch (err: any) {
    console.error('[files] Upload error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/files/:id
 * Delete a file and its chunks
 */
router.delete('/:id', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM file_library WHERE id = ?').get(req.params.id) as any;
    if (!row) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    // Delete file from disk
    const filePath = path.join(UPLOADS_DIR, row.stored_name);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (fsErr: any) {
      console.warn(`[files] Could not delete file from disk: ${fsErr.message}`);
    }

    // Delete from DB (chunks cascade deleted via FK)
    db.prepare('DELETE FROM file_library WHERE id = ?').run(req.params.id);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/files/:id/reindex
 * Re-process a file (re-extract, re-chunk, re-embed)
 */
router.post('/:id/reindex', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM file_library WHERE id = ?').get(req.params.id) as any;
    if (!row) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const filePath = path.join(UPLOADS_DIR, row.stored_name);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found on disk' });
    }

    // Delete existing chunks
    db.prepare('DELETE FROM file_chunks WHERE file_id = ?').run(req.params.id);

    // Reset status
    db.prepare(`UPDATE file_library SET status = 'processing', chunk_count = 0, error_message = NULL, updated_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), req.params.id);

    // Re-process asynchronously
    processFile(req.params.id, filePath, row.mime_type, row.original_name).catch(err => {
      console.error(`[files] Reindex failed for ${row.original_name}:`, err.message);
    });

    res.json({ success: true, data: { status: 'processing' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/files/search
 * Search file chunks by semantic similarity
 */
router.post('/search', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { query, fileIds, limit } = req.body;
    if (!query) {
      return res.status(400).json({ success: false, error: 'query is required' });
    }

    const db = getDb();

    // If no fileIds specified, search all files
    let targetFileIds: string[];
    if (fileIds && Array.isArray(fileIds) && fileIds.length > 0) {
      targetFileIds = fileIds;
    } else {
      const rows = db.prepare('SELECT id FROM file_library WHERE status = ?').all('ready') as any[];
      targetFileIds = rows.map((r: any) => r.id);
    }

    if (targetFileIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const queryEmbedding = await generateEmbedding(query);
    const results = searchFileChunks(queryEmbedding, targetFileIds, limit || 5);

    res.json({ success: true, data: results });
  } catch (err: any) {
    console.error('[files] Search error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

function rowToFile(row: any): FileLibraryEntry {
  return {
    id: row.id,
    originalName: row.original_name,
    storedName: row.stored_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    chunkCount: row.chunk_count,
    status: row.status,
    errorMessage: row.error_message,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default router;
