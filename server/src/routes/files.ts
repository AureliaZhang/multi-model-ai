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
import type { FileLibraryEntry, FileFolder } from '../types';

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

// ──────────────────────────────────────────────
// Folder endpoints
// ──────────────────────────────────────────────

/**
 * GET /api/files/folders
 * List all folders (optionally filtered by parent_id)
 */
router.get('/folders', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const parentId = req.query.parent_id as string | undefined;

    let rows;
    if (parentId) {
      rows = db.prepare('SELECT * FROM file_folders WHERE parent_id = ? ORDER BY name ASC').all(parentId) as any[];
    } else {
      rows = db.prepare('SELECT * FROM file_folders ORDER BY name ASC').all() as any[];
    }

    const folders: FileFolder[] = rows.map(rowToFolder);
    res.json({ success: true, data: folders });
  } catch (err: any) {
    console.error('[files] Error listing folders:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/files/folders
 * Create a new folder
 */
router.post('/folders', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { name, parentId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Folder name is required' });
    }

    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    // If parentId provided, verify it exists
    if (parentId) {
      const parent = db.prepare('SELECT id FROM file_folders WHERE id = ?').get(parentId) as any;
      if (!parent) {
        return res.status(404).json({ success: false, error: 'Parent folder not found' });
      }
    }

    db.prepare(`
      INSERT INTO file_folders (id, name, parent_id, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name.trim(), parentId || null, req.user?.id || null, now, now);

    const folder: FileFolder = {
      id,
      name: name.trim(),
      parentId: parentId || null,
      createdBy: req.user?.id || null,
      createdAt: now,
      updatedAt: now,
    };

    res.json({ success: true, data: folder });
  } catch (err: any) {
    console.error('[files] Error creating folder:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/files/folders/:id
 * Rename a folder
 */
router.put('/folders/:id', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Folder name is required' });
    }

    const db = getDb();
    const row = db.prepare('SELECT * FROM file_folders WHERE id = ?').get(req.params.id) as any;
    if (!row) {
      return res.status(404).json({ success: false, error: 'Folder not found' });
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE file_folders SET name = ?, updated_at = ? WHERE id = ?').run(name.trim(), now, req.params.id);

    res.json({ success: true, data: { ...rowToFolder(row), name: name.trim(), updatedAt: now } });
  } catch (err: any) {
    console.error('[files] Error renaming folder:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/files/folders/:id
 * Delete a folder (files inside are moved to root, subfolders cascade deleted)
 */
router.delete('/folders/:id', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM file_folders WHERE id = ?').get(req.params.id) as any;
    if (!row) {
      return res.status(404).json({ success: false, error: 'Folder not found' });
    }

    // Move files in this folder to root (folder_id = NULL)
    db.prepare('UPDATE file_library SET folder_id = NULL WHERE folder_id = ?').run(req.params.id);

    // Delete folder (subfolders cascade via FK)
    db.prepare('DELETE FROM file_folders WHERE id = ?').run(req.params.id);

    res.json({ success: true });
  } catch (err: any) {
    console.error('[files] Error deleting folder:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/files/folders/:id/path
 * Get breadcrumb path for a folder
 */
router.get('/folders/:id/path', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const pathArr: { id: string; name: string }[] = [];
    let currentId: string | null = req.params.id;

    while (currentId) {
      const row = db.prepare('SELECT id, name, parent_id FROM file_folders WHERE id = ?').get(currentId) as any;
      if (!row) break;
      pathArr.unshift({ id: row.id, name: row.name });
      currentId = row.parent_id;
    }

    res.json({ success: true, data: pathArr });
  } catch (err: any) {
    console.error('[files] Error getting folder path:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────
// File endpoints
// ──────────────────────────────────────────────

/**
 * GET /api/files
 * List files and folders in a given folder (or root)
 */
router.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const folderId = req.query.folder_id as string | undefined;

    // Get folders in current directory
    let folderQuery = 'SELECT * FROM file_folders';
    let fileQuery = 'SELECT * FROM file_library';
    let countQuery = 'SELECT COUNT(*) as total FROM file_library';
    const folderParams: any[] = [];
    const fileParams: any[] = [];

    if (folderId) {
      folderQuery += ' WHERE parent_id = ?';
      fileQuery += ' WHERE folder_id = ?';
      countQuery += ' WHERE folder_id = ?';
      folderParams.push(folderId);
      fileParams.push(folderId);
    } else {
      folderQuery += ' WHERE parent_id IS NULL';
      fileQuery += ' WHERE folder_id IS NULL';
      countQuery += ' WHERE folder_id IS NULL';
    }

    folderQuery += ' ORDER BY name ASC';
    fileQuery += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

    const folders = db.prepare(folderQuery).all(...folderParams) as any[];
    const rows = db.prepare(fileQuery).all(...fileParams, limit, offset) as any[];
    const countRow = db.prepare(countQuery).get(...fileParams) as any;

    const files: FileLibraryEntry[] = rows.map(rowToFile);

    res.json({
      success: true,
      data: {
        folders: folders.map(rowToFolder),
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
 * Upload one or more files, optionally into a folder
 */
router.post('/upload', requireAuth, upload.array('files', 20), async (req: AuthRequest, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    const db = getDb();
    const now = new Date().toISOString();
    const folderId = (req.body.folder_id as string) || null;

    // Validate folder exists if provided
    if (folderId) {
      const folder = db.prepare('SELECT id FROM file_folders WHERE id = ?').get(folderId) as any;
      if (!folder) {
        return res.status(404).json({ success: false, error: 'Folder not found' });
      }
    }

    const insertStmt = db.prepare(`
      INSERT INTO file_library (id, original_name, stored_name, mime_type, file_size, status, folder_id, uploaded_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'processing', ?, ?, ?, ?)
    `);

    const results: FileLibraryEntry[] = [];

    for (const file of files) {
      const fileId = uuidv4();
      const mimeType = file.mimetype || 'application/octet-stream';
      // Fix filename encoding: multer may deliver non-ASCII filenames as latin1
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

      insertStmt.run(fileId, originalName, file.filename, mimeType, file.size, folderId, req.user?.id || null, now, now);

      results.push({
        id: fileId,
        originalName,
        storedName: file.filename,
        mimeType,
        fileSize: file.size,
        chunkCount: 0,
        status: 'processing',
        errorMessage: null,
        folderId,
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
 * PATCH /api/files/:id/move
 * Move a file to a different folder
 */
router.patch('/:id/move', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { folderId } = req.body;
    const db = getDb();

    const row = db.prepare('SELECT * FROM file_library WHERE id = ?').get(req.params.id) as any;
    if (!row) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    // Validate folder exists if provided (null means root)
    if (folderId) {
      const folder = db.prepare('SELECT id FROM file_folders WHERE id = ?').get(folderId) as any;
      if (!folder) {
        return res.status(404).json({ success: false, error: 'Target folder not found' });
      }
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE file_library SET folder_id = ?, updated_at = ? WHERE id = ?').run(folderId || null, now, req.params.id);

    res.json({ success: true, data: { ...rowToFile(row), folderId: folderId || null, updatedAt: now } });
  } catch (err: any) {
    console.error('[files] Error moving file:', err.message);
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

function rowToFolder(row: any): FileFolder {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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
    folderId: row.folder_id || null,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default router;
