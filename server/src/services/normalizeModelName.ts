/**
 * Normalize a model id/display name for cross-station deduplication.
 *
 * Same rules used by the models list aggregator, load-balancer key, chat/media
 * resolution, and user prefs. Kept in its own module so unit tests can import
 * it without loading the Express router / DB.
 */
export function normalizeModelName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
