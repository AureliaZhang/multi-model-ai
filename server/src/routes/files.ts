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
import type { FileFolderRow, FileLibraryRow, FileChunkListRow } from '../dbRows';
import { getErrorMessage } from '../utils/errors';
import { summarizeKbFile } from '../services/kbSummarizer';
import { importUrlToKb } from '../services/kbUrlImport';

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
      rows = db.prepare('SELECT * FROM file_folders WHERE parent_id = ? ORDER BY name ASC').all(parentId) as FileFolderRow[];
    } else {
      rows = db.prepare('SELECT * FROM file_folders ORDER BY name ASC').all() as FileFolderRow[];
    }

    const folders: FileFolder[] = rows.map(rowToFolder);
    res.json({ success: true, data: folders });
  } catch (err: unknown) {
    console.error('[files] Error listing folders:', getErrorMessage(err));
    res.status(500).json({ success: false, error: getErrorMessage(err) });
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
      const parent = db.prepare('SELECT id FROM file_folders WHERE id = ?').get(parentId) as { id: string } | undefined;
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
  } catch (err: unknown) {
    console.error('[files] Error creating folder:', getErrorMessage(err));
    res.status(500).json({ success: false, error: getErrorMessage(err) });
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
    const row = db.prepare('SELECT * FROM file_folders WHERE id = ?').get(req.params.id) as FileFolderRow | undefined;
    if (!row) {
      return res.status(404).json({ success: false, error: 'Folder not found' });
    }
    if (!canMutateOwn(req, row.created_by)) {
      return res.status(403).json({ success: false, error: 'You do not have permission to rename this folder' });
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE file_folders SET name = ?, updated_at = ? WHERE id = ?').run(name.trim(), now, req.params.id);

    res.json({ success: true, data: { ...rowToFolder(row), name: name.trim(), updatedAt: now } });
  } catch (err: unknown) {
    console.error('[files] Error renaming folder:', getErrorMessage(err));
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

/**
 * DELETE /api/files/folders/:id
 * Delete a folder (files inside are moved to root, subfolders cascade deleted)
 */
router.delete('/folders/:id', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM file_folders WHERE id = ?').get(req.params.id) as FileFolderRow | undefined;
    if (!row) {
      return res.status(404).json({ success: false, error: 'Folder not found' });
    }
    if (!canMutateOwn(req, row.created_by)) {
      return res.status(403).json({ success: false, error: 'You do not have permission to delete this folder' });
    }

    // Move files in this folder to root (folder_id = NULL)
    db.prepare('UPDATE file_library SET folder_id = NULL WHERE folder_id = ?').run(req.params.id);

    // Delete folder (subfolders cascade via FK)
    db.prepare('DELETE FROM file_folders WHERE id = ?').run(req.params.id);

    res.json({ success: true });
  } catch (err: unknown) {
    console.error('[files] Error deleting folder:', getErrorMessage(err));
    res.status(500).json({ success: false, error: getErrorMessage(err) });
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
      const row = db.prepare('SELECT id, name, parent_id FROM file_folders WHERE id = ?').get(currentId) as Pick<FileFolderRow, 'id' | 'name' | 'parent_id'> | undefined;
      if (!row) break;
      pathArr.unshift({ id: row.id, name: row.name });
      currentId = row.parent_id;
    }

    res.json({ success: true, data: pathArr });
  } catch (err: unknown) {
    console.error('[files] Error getting folder path:', getErrorMessage(err));
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

// ──────────────────────────────────────────────
// File endpoints
// ──────────────────────────────────────────────

/**
 * GET /api/files?scope=mine|team&folder_id=&page=&limit=
 *
 * Two views (default-private, opt-in team-shared library — §10.8 Phase 4):
 *  - scope=mine (default): the caller's OWN files, browsable by folder. Folders
 *    are those the caller created; files are those they uploaded. Even admins see
 *    only their own here (their moderation power is on mutate, not on browsing
 *    everyone's private files).
 *  - scope=team: a FLAT list of every file shared to the team (visibility='team'),
 *    ignoring folders entirely (a shared file may live in someone's private
 *    folder, so folder structure can't be shown coherently). No folders returned.
 */
router.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const scope = req.query.scope === 'team' ? 'team' : req.query.scope === 'kb' ? 'kb' : 'mine';
    const userId = req.user!.id;

    if (scope === 'kb') {
      // Knowledge base (v0.7.65): flat, team-visible by definition, searchable
      // across name/summary/keywords/type. Everyone may read; deletion stays
      // uploader/admin-gated like any file.
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const docType = typeof req.query.doc_type === 'string' ? req.query.doc_type.trim() : '';
      const where: string[] = ['kb = 1'];
      const params: (string | number)[] = [];
      if (q) {
        const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
        where.push(`(original_name LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\' OR ai_keywords LIKE ? ESCAPE '\\' OR doc_type LIKE ? ESCAPE '\\')`);
        params.push(like, like, like, like);
      }
      if (docType) {
        where.push('doc_type = ?');
        params.push(docType);
      }
      const whereSql = where.join(' AND ');
      const rows = db.prepare(
        `SELECT * FROM file_library WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).all(...params, limit, offset) as FileLibraryRow[];
      const countRow = db.prepare(
        `SELECT COUNT(*) as total FROM file_library WHERE ${whereSql}`
      ).get(...params) as { total: number };
      return res.json({
        success: true,
        data: {
          folders: [],
          files: rows.map(rowToFile),
          total: countRow.total,
          page,
          limit,
          totalPages: Math.ceil(countRow.total / limit),
        },
      });
    }

    if (scope === 'team') {
      // Flat: all team-shared files, no folder scoping.
      const rows = db
        .prepare(
          `SELECT * FROM file_library WHERE visibility = 'team'
           ORDER BY created_at DESC LIMIT ? OFFSET ?`
        )
        .all(limit, offset) as FileLibraryRow[];
      const countRow = db
        .prepare(`SELECT COUNT(*) as total FROM file_library WHERE visibility = 'team'`)
        .get() as { total: number };

      return res.json({
        success: true,
        data: {
          folders: [],
          files: rows.map(rowToFile),
          total: countRow.total,
          page,
          limit,
          totalPages: Math.ceil(countRow.total / limit),
        },
      });
    }

    // scope=mine: own files, browsable by folder.
    const folderId = req.query.folder_id as string | undefined;
    const folderParams: (string | number)[] = [userId];
    const fileParams: (string | number)[] = [userId];
    let folderQuery = 'SELECT * FROM file_folders WHERE created_by = ?';
    let fileQuery = 'SELECT * FROM file_library WHERE uploaded_by = ?';
    let countQuery = 'SELECT COUNT(*) as total FROM file_library WHERE uploaded_by = ?';

    if (folderId) {
      folderQuery += ' AND parent_id = ?';
      fileQuery += ' AND folder_id = ?';
      countQuery += ' AND folder_id = ?';
      folderParams.push(folderId);
      fileParams.push(folderId);
    } else {
      folderQuery += ' AND parent_id IS NULL';
      fileQuery += ' AND folder_id IS NULL';
      countQuery += ' AND folder_id IS NULL';
    }

    folderQuery += ' ORDER BY name ASC';
    fileQuery += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

    const folders = db.prepare(folderQuery).all(...folderParams) as FileFolderRow[];
    const rows = db.prepare(fileQuery).all(...fileParams, limit, offset) as FileLibraryRow[];
    const countRow = db.prepare(countQuery).get(...fileParams) as { total: number };

    res.json({
      success: true,
      data: {
        folders: folders.map(rowToFolder),
        files: rows.map(rowToFile),
        total: countRow.total,
        page,
        limit,
        totalPages: Math.ceil(countRow.total / limit),
      },
    });
  } catch (err: unknown) {
    console.error('[files] Error listing files:', getErrorMessage(err));
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

/**
 * GET /api/files/:id
 * Get single file details
 */
router.get('/:id', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM file_library WHERE id = ?').get(req.params.id) as FileLibraryRow | undefined;
    if (!row || !canSeeFile(req.user, row)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    res.json({ success: true, data: rowToFile(row) });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
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

    // Read gate: don't leak another member's private file content via chunks.
    const owner = db.prepare('SELECT uploaded_by, visibility FROM file_library WHERE id = ?').get(req.params.id) as
      | Pick<FileLibraryRow, 'uploaded_by' | 'visibility'>
      | undefined;
    if (!owner) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    if (!canSeeFile(req.user, owner)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const rows = db.prepare(`
      SELECT id, file_id, chunk_index, content, token_count, created_at
      FROM file_chunks
      WHERE file_id = ?
      ORDER BY chunk_index ASC
      LIMIT ? OFFSET ?
    `).all(req.params.id, limit, offset) as FileChunkListRow[];

    const countRow = db.prepare('SELECT COUNT(*) as total FROM file_chunks WHERE file_id = ?').get(req.params.id) as { total: number };

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
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
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
    // Knowledge-base upload (v0.7.65): team-visible by definition, flat (no folder),
    // auto-digested once text extraction completes.
    const isKb = req.body.kb === '1' || req.body.kb === 'true';
    const folderId = isKb ? null : (req.body.folder_id as string) || null;

    // Validate folder exists if provided
    if (folderId) {
      const folder = db.prepare('SELECT id FROM file_folders WHERE id = ?').get(folderId) as { id: string } | undefined;
      if (!folder) {
        return res.status(404).json({ success: false, error: 'Folder not found' });
      }
    }

    const insertStmt = db.prepare(`
      INSERT INTO file_library (id, original_name, stored_name, mime_type, file_size, status, folder_id, uploaded_by, visibility, kb, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'processing', ?, ?, ?, ?, ?, ?)
    `);

    const results: FileLibraryEntry[] = [];

    for (const file of files) {
      const fileId = uuidv4();
      const mimeType = file.mimetype || 'application/octet-stream';
      // Fix filename encoding: multer may deliver non-ASCII filenames as latin1
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

      insertStmt.run(fileId, originalName, file.filename, mimeType, file.size, folderId, req.user?.id || null, isKb ? 'team' : 'private', isKb ? 1 : 0, now, now);

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
        visibility: isKb ? 'team' : 'private',
        kb: isKb,
        summaryStatus: 'none',
        createdAt: now,
        updatedAt: now,
      });

      // Process file asynchronously (don't await - fire and forget)
      const filePath = path.join(UPLOADS_DIR, file.filename);
      processFile(fileId, filePath, mimeType, originalName)
        .then(() => {
          // KB pipeline: digest right after extraction (fire-and-forget; failures
          // land in summary_status='error' with a retry button in the UI).
          if (isKb) return summarizeKbFile(fileId).then(() => undefined);
        })
        .catch(err => {
          console.error(`[files] Background processing failed for ${originalName}:`, getErrorMessage(err));
        });
    }

    res.json({ success: true, data: results });
  } catch (err: unknown) {
    console.error('[files] Upload error:', getErrorMessage(err));
    res.status(500).json({ success: false, error: getErrorMessage(err) });
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

    const row = db.prepare('SELECT * FROM file_library WHERE id = ?').get(req.params.id) as FileLibraryRow | undefined;
    if (!row) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    // Validate folder exists if provided (null means root)
    if (folderId) {
      const folder = db.prepare('SELECT id FROM file_folders WHERE id = ?').get(folderId) as { id: string } | undefined;
      if (!folder) {
        return res.status(404).json({ success: false, error: 'Target folder not found' });
      }
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE file_library SET folder_id = ?, updated_at = ? WHERE id = ?').run(folderId || null, now, req.params.id);

    res.json({ success: true, data: { ...rowToFile(row), folderId: folderId || null, updatedAt: now } });
  } catch (err: unknown) {
    console.error('[files] Error moving file:', getErrorMessage(err));
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

/** Mutate access: admin, or the real owner. Legacy ownerless rows → admin only. */
function canMutateOwn(req: AuthRequest, ownerId: string | null): boolean {
  const u = req.user;
  if (!u) return false;
  return u.role === 'admin' || (ownerId != null && ownerId === u.id);
}

/** Read access for a file (default-private model, §10.8 Phase 4):
 *  admin sees all; the uploader sees their own; anyone sees a 'team' file;
 *  legacy ownerless rows are treated as team-visible (they were migrated to
 *  'team', so this only matters for rows inserted without an owner). */
export function canSeeFile(
  user: { id: string; role: string } | null | undefined,
  row: Pick<FileLibraryRow, 'uploaded_by' | 'visibility'>
): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (row.uploaded_by != null && row.uploaded_by === user.id) return true;
  if (row.visibility === 'team') return true;
  return row.uploaded_by == null; // legacy ownerless → shared
}

/** Given a client-supplied list of file ids, return only the ones the caller may
 *  actually read. This is the RAG isolation gate — both the chat file-context
 *  injection and POST /search must pass ids through here so a member can never
 *  read another member's private file by guessing/forging its id. */
export function filterVisibleFileIds(
  db: import('better-sqlite3').Database,
  fileIds: string[],
  user: { id: string; role: string } | null | undefined
): string[] {
  if (!user || fileIds.length === 0) return [];
  const placeholders = fileIds.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT id, uploaded_by, visibility FROM file_library WHERE id IN (${placeholders})`)
    .all(...fileIds) as Pick<FileLibraryRow, 'id' | 'uploaded_by' | 'visibility'>[];
  return rows.filter((r) => canSeeFile(user, r)).map((r) => r.id);
}

/**
 * DELETE /api/files/:id
 * Delete a file and its chunks (owner or admin only)
 */
router.delete('/:id', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM file_library WHERE id = ?').get(req.params.id) as FileLibraryRow | undefined;
    if (!row) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    if (!canMutateOwn(req, row.uploaded_by)) {
      return res.status(403).json({ success: false, error: 'You do not have permission to delete this file' });
    }

    // Delete file from disk
    const filePath = path.join(UPLOADS_DIR, row.stored_name);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (fsErr: unknown) {
      console.warn(`[files] Could not delete file from disk: ${getErrorMessage(fsErr)}`);
    }

    // Delete from DB (chunks cascade deleted via FK)
    db.prepare('DELETE FROM file_library WHERE id = ?').run(req.params.id);

    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

/**
 * POST /api/files/:id/reindex
 * Re-process a file (re-extract, re-chunk, re-embed)
 */
router.post('/:id/reindex', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM file_library WHERE id = ?').get(req.params.id) as FileLibraryRow | undefined;
    if (!row) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    if (!canMutateOwn(req, row.uploaded_by)) {
      return res.status(403).json({ success: false, error: 'You do not have permission to reindex this file' });
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
      console.error(`[files] Reindex failed for ${row.original_name}:`, getErrorMessage(err));
    });

    res.json({ success: true, data: { status: 'processing' } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

/**
 * PATCH /api/files/:id/visibility  { visibility: 'private' | 'team' }
 * Share a file with the team or make it private again. Owner or admin only.
 */
router.patch('/:id/visibility', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { visibility } = req.body as { visibility?: string };
    if (visibility !== 'private' && visibility !== 'team') {
      return res.status(400).json({ success: false, error: "visibility must be 'private' or 'team'" });
    }
    const db = getDb();
    const row = db.prepare('SELECT * FROM file_library WHERE id = ?').get(req.params.id) as FileLibraryRow | undefined;
    if (!row) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    if (!canMutateOwn(req, row.uploaded_by)) {
      return res.status(403).json({ success: false, error: 'You do not have permission to change this file' });
    }
    const now = new Date().toISOString();
    db.prepare('UPDATE file_library SET visibility = ?, updated_at = ? WHERE id = ?').run(visibility, now, req.params.id);
    res.json({ success: true, data: { ...rowToFile(row), visibility, updatedAt: now } });
  } catch (err: unknown) {
    console.error('[files] Error changing visibility:', getErrorMessage(err));
    res.status(500).json({ success: false, error: getErrorMessage(err) });
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
      const rows = db.prepare('SELECT id FROM file_library WHERE status = ?').all('ready') as { id: string }[];
      targetFileIds = rows.map((r: any) => r.id);
    }

    if (targetFileIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const queryEmbedding = await generateEmbedding(query);
    const results = searchFileChunks(queryEmbedding, targetFileIds, limit || 5);

    res.json({ success: true, data: results });
  } catch (err: unknown) {
    console.error('[files] Search error:', getErrorMessage(err));
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

/**
 * GET /api/files/:id/reading — the knowledge-base reading view (v0.7.65):
 * the file's extracted text reassembled from its chunks, served as markdown-
 * renderable text, plus the entry (digest included). Read access = canSeeFile.
 */
router.get('/:id/reading', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM file_library WHERE id = ?').get(req.params.id) as FileLibraryRow | undefined;
    if (!row || !canSeeFile(req.user, row)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    const chunks = db.prepare(
      'SELECT content FROM file_chunks WHERE file_id = ? ORDER BY chunk_index ASC'
    ).all(req.params.id) as Array<{ content: string }>;
    res.json({
      success: true,
      data: { file: rowToFile(row), markdown: chunks.map((c) => c.content).join('\n\n') },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

/**
 * GET /api/files/:id/original — download the ORIGINAL uploaded file (v0.7.65
 * 查看原文). The bytes were always kept on disk; this is the door to them.
 */
router.get('/:id/original', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM file_library WHERE id = ?').get(req.params.id) as FileLibraryRow | undefined;
    if (!row || !canSeeFile(req.user, row)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    const filePath = path.join(UPLOADS_DIR, row.stored_name);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Original file is no longer on disk' });
    }
    res.download(filePath, row.original_name);
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

/**
 * POST /api/files/:id/summarize — (re)generate the AI digest (v0.7.65).
 * Any member may fill in a MISSING/FAILED digest; regenerating an existing one
 * is uploader/admin only (it costs tokens and overwrites).
 */
router.post('/:id/summarize', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM file_library WHERE id = ?').get(req.params.id) as FileLibraryRow | undefined;
    if (!row || !canSeeFile(req.user, row)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    const isOwner = req.user!.role === 'admin' || (row.uploaded_by != null && row.uploaded_by === req.user!.id);
    if (row.summary_status === 'ready' && !isOwner) {
      return res.status(403).json({ success: false, error: 'Only the uploader or an admin can regenerate an existing digest' });
    }
    if (row.summary_status === 'pending') {
      return res.status(409).json({ success: false, error: 'A digest is already being generated for this file' });
    }
    const result = await summarizeKbFile(req.params.id, db);
    if (!result.ok) {
      return res.status(502).json({ success: false, error: `Digest generation failed (${result.reason})` });
    }
    const updated = db.prepare('SELECT * FROM file_library WHERE id = ?').get(req.params.id) as FileLibraryRow;
    res.json({ success: true, data: rowToFile(updated) });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

/**
 * POST /api/files/kb-url  { url } — import a web page into the knowledge base
 * (v0.7.67). Server-side fetch (SSRF-guarded), HTML→text conversion, then the
 * normal KB pipeline (chunks → embeddings → AI digest).
 */
router.post('/kb-url', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { url } = req.body as { url?: unknown };
    if (typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ success: false, error: 'url is required' });
    }
    const result = await importUrlToKb(url.trim(), req.user?.id || null);
    if (!result.ok) {
      return res.status(400).json({ success: false, error: `URL import failed (${result.reason})` });
    }
    const db = getDb();
    const row = db.prepare('SELECT * FROM file_library WHERE id = ?').get(result.fileId) as FileLibraryRow;
    res.status(201).json({ success: true, data: rowToFile(row) });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
});

function rowToFolder(row: FileFolderRow): FileFolder {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToFile(row: FileLibraryRow): FileLibraryEntry {
  return {
    id: row.id,
    originalName: row.original_name,
    storedName: row.stored_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    chunkCount: row.chunk_count,
    status: row.status as FileLibraryEntry['status'],
    errorMessage: row.error_message,
    folderId: row.folder_id || null,
    uploadedBy: row.uploaded_by,
    visibility: (row.visibility === 'team' ? 'team' : 'private'),
    kb: Boolean(row.kb),
    summary: row.summary ?? null,
    docType: row.doc_type ?? null,
    aiKeywords: (() => { try { return JSON.parse(row.ai_keywords || '[]') as string[]; } catch { return []; } })(),
    summaryStatus: (['none', 'pending', 'ready', 'error'].includes(row.summary_status) ? row.summary_status : 'none') as FileLibraryEntry['summaryStatus'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default router;
