import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  serializeEmbedding,
  deserializeEmbedding,
} from './embeddings';

describe('cosineSimilarity', () => {
  it('returns 1 for identical unit vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it('returns 0 when lengths differ', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2])).toBe(0);
  });

  it('returns 0 when either vector is all zeros', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([1, 2, 3], [0, 0, 0])).toBe(0);
  });

  it('is symmetric', () => {
    const a = [0.2, 0.5, 0.8];
    const b = [0.1, 0.4, 0.9];
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a));
  });

  it('ranks a closer vector higher than a farther one', () => {
    const query = [1, 0, 0];
    const near = [0.9, 0.1, 0];
    const far = [0, 1, 0];
    expect(cosineSimilarity(query, near)).toBeGreaterThan(cosineSimilarity(query, far));
  });
});

describe('serializeEmbedding / deserializeEmbedding', () => {
  it('round-trips a non-empty vector', () => {
    const v = [0.1, -0.2, 0.3, 1];
    const json = serializeEmbedding(v);
    expect(typeof json).toBe('string');
    expect(deserializeEmbedding(json)).toEqual(v);
  });

  it('returns null for empty array JSON', () => {
    expect(deserializeEmbedding('[]')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(deserializeEmbedding('not-json')).toBeNull();
    expect(deserializeEmbedding('{')).toBeNull();
  });

  it('returns null for non-array JSON', () => {
    expect(deserializeEmbedding('{"a":1}')).toBeNull();
    expect(deserializeEmbedding('42')).toBeNull();
    expect(deserializeEmbedding('"hi"')).toBeNull();
  });
});
