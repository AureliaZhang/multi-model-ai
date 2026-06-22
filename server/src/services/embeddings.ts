/**
 * Embedding Service
 * 
 * Generates vector embeddings for memory entries using:
 * 1. OpenAI-compatible /embeddings API (primary) - tries all available stations
 * 2. Local hash-based embedding (fallback) - deterministic, no API needed
 * 
 * Provides cosine similarity search for retrieval.
 */

import { getDb } from '../database';

// Embedding dimension for local fallback (compact but effective)
const LOCAL_EMBEDDING_DIM = 256;

// Cache for API embedding model availability per station
const stationEmbeddingSupport = new Map<string, boolean>();

/**
 * Generate an embedding vector for the given text.
 * Tries API first, falls back to local hash-based embedding.
 * Returns a number[] (the vector).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Try API-based embedding first
  const apiEmbedding = await generateApiEmbedding(text);
  if (apiEmbedding) {
    return apiEmbedding;
  }

  // Fallback to local hash-based embedding
  return generateLocalEmbedding(text);
}

/**
 * Generate embedding via OpenAI-compatible /embeddings API.
 * Tries each station that has an embedding model configured.
 * Returns null if no station supports it.
 */
async function generateApiEmbedding(text: string): Promise<number[] | null> {
  try {
    const db = getDb();
    const stations = db.prepare(
      'SELECT id, name, base_url, api_key, health_status FROM stations WHERE enabled = 1 AND health_status != ?'
    ).all('unhealthy') as any[];

    for (const station of stations) {
      // Skip stations known to not support embeddings
      if (stationEmbeddingSupport.get(station.id) === false) continue;

      try {
        // Try common embedding model names
        const embeddingModels = [
          'text-embedding-3-small',
          'text-embedding-3-large',
          'text-embedding-ada-002',
          'embedding',
        ];

        for (const model of embeddingModels) {
          const truncatedText = text.length > 8000 ? text.substring(0, 8000) : text;
          
          const response = await fetch(`${station.base_url}/embeddings`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${station.api_key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              input: truncatedText,
            }),
            signal: AbortSignal.timeout(10000), // 10s timeout
          });

          if (response.ok) {
            const data = await response.json() as any;
            const embedding = data.data?.[0]?.embedding;
            if (Array.isArray(embedding) && embedding.length > 0) {
              stationEmbeddingSupport.set(station.id, true);
              console.log(`[embeddings] API embedding generated via ${station.name} (model: ${model}), dim=${embedding.length}`);
              return embedding;
            }
          }
        }

        // None of the embedding models worked for this station
        stationEmbeddingSupport.set(station.id, false);
      } catch (err: any) {
        // Network error or timeout - don't mark as unsupported, might be temporary
        console.warn(`[embeddings] Station ${station.name} embedding attempt failed: ${err.message}`);
      }
    }

    return null;
  } catch (err: any) {
    console.error('[embeddings] API embedding error:', err.message);
    return null;
  }
}

/**
 * Generate a local hash-based embedding vector.
 * Uses a bag-of-words approach with feature hashing into a fixed-dimension vector.
 * Deterministic: same text always produces the same vector.
 * Good enough for semantic similarity when API is unavailable.
 */
function generateLocalEmbedding(text: string): number[] {
  const vector = new Array(LOCAL_EMBEDDING_DIM).fill(0);

  // Tokenize: extract words and Chinese character n-grams
  const tokens = tokenize(text);

  // Feature hashing (hashing trick)
  for (const token of tokens) {
    const hash = fnv1aHash(token);
    const idx = hash % LOCAL_EMBEDDING_DIM;
    // Use +1/-1 based on a second hash for sign
    const sign = (fnv1aHash(token + '_sign') % 2 === 0) ? 1 : -1;
    vector[idx] += sign;
  }

  // L2 normalize
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= norm;
    }
  }

  return vector;
}

/**
 * Tokenize text into meaningful tokens for embedding.
 * Handles both English words and Chinese character n-grams.
 */
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const lower = text.toLowerCase();

  // English words (3+ chars)
  const englishWords = lower.match(/[a-z]{3,}/g) || [];
  tokens.push(...englishWords);

  // Chinese character bigrams and trigrams
  const chineseChars = text.match(/[\u4e00-\u9fff]+/g) || [];
  for (const segment of chineseChars) {
    for (let i = 0; i < segment.length - 1; i++) {
      tokens.push(segment.substring(i, i + 2));
      if (i < segment.length - 2) {
        tokens.push(segment.substring(i, i + 3));
      }
    }
  }

  return tokens;
}

/**
 * FNV-1a hash function (32-bit).
 * Fast, good distribution for feature hashing.
 */
function fnv1aHash(str: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0; // FNV prime, unsigned
  }
  return hash;
}

/**
 * Compute cosine similarity between two vectors.
 * Returns a value between -1 and 1 (higher = more similar).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Search for the most similar memories using vector cosine similarity.
 * Loads all embeddings from DB, computes similarity, returns top matches.
 * 
 * @param db - Database instance
 * @param queryEmbedding - The query vector
 * @param limit - Max results
 * @param threshold - Minimum similarity threshold (default 0.3)
 */
export function vectorSearch(
  db: any,
  queryEmbedding: number[],
  limit: number = 5,
  threshold: number = 0.3
): any[] {
  // Load all entries that have embeddings
  const rows = db.prepare(`
    SELECT id, summary, content, keywords, created_at, role, importance, embedding
    FROM memory_entries
    WHERE embedding IS NOT NULL AND embedding != ''
  `).all() as any[];

  if (rows.length === 0) return [];

  // Compute similarity for each entry
  const scored: { row: any; similarity: number }[] = [];

  for (const row of rows) {
    try {
      const entryEmbedding = JSON.parse(row.embedding) as number[];
      const similarity = cosineSimilarity(queryEmbedding, entryEmbedding);
      
      if (similarity >= threshold) {
        scored.push({ row, similarity });
      }
    } catch {
      // Skip entries with invalid embeddings
    }
  }

  // Sort by similarity (descending), then by importance
  scored.sort((a, b) => {
    const simDiff = b.similarity - a.similarity;
    if (Math.abs(simDiff) > 0.05) return simDiff;
    return (b.row.importance || 0) - (a.row.importance || 0);
  });

  // Return top N results (without the embedding column to save bandwidth)
  return scored.slice(0, limit).map(({ row }) => ({
    summary: row.summary,
    content: row.content,
    keywords: row.keywords,
    created_at: row.created_at,
    role: row.role,
    importance: row.importance,
  }));
}

/**
 * Serialize an embedding vector to JSON string for SQLite storage.
 */
export function serializeEmbedding(embedding: number[]): string {
  return JSON.stringify(embedding);
}

/**
 * Deserialize an embedding from SQLite JSON string.
 * Returns null if invalid.
 */
export function deserializeEmbedding(json: string): number[] | null {
  try {
    const arr = JSON.parse(json);
    if (Array.isArray(arr) && arr.length > 0) {
      return arr;
    }
    return null;
  } catch {
    return null;
  }
}
