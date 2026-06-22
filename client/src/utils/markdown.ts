/**
 * Normalize markdown content for better rendering.
 * - Converts pipe-delimited lines (without proper separator rows) into valid markdown tables
 * - Handles common LLM output quirks
 */
export function normalizeMarkdown(content: string): string {
  if (!content) return content;

  const lines = content.split('\n');
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip code blocks - don't touch content inside them
    if (line.match(/^```/)) {
      result.push(line);
      i++;
      while (i < lines.length && !lines[i].match(/^```/)) {
        result.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        result.push(lines[i]); // closing ```
      }
      i++;
      continue;
    }

    // Check if this line looks like a table row (has | separators)
    if (isTableRow(line)) {
      const tableLines: string[] = [line];
      let j = i + 1;

      // Collect consecutive table-like lines
      while (j < lines.length && isTableRow(lines[j])) {
        tableLines.push(lines[j]);
        j++;
      }

      // Need at least 2 lines to form a table
      if (tableLines.length >= 2) {
        const normalized = normalizeTableLines(tableLines);
        result.push(...normalized);
      } else {
        result.push(...tableLines);
      }

      i = j;
    } else {
      result.push(line);
      i++;
    }
  }

  return result.join('\n');
}

/**
 * Check if a line looks like a markdown table row
 */
function isTableRow(line: string): boolean {
  if (!line || !line.includes('|')) return false;

  // Trim the line
  const trimmed = line.trim();

  // Must start and end with | (or have | in the middle)
  // A table row typically has the form: | cell | cell | cell |
  const pipeCount = (trimmed.match(/\|/g) || []).length;
  if (pipeCount < 2) return false;

  // Exclude lines that are likely just prose with a single |
  // e.g., "use the | operator" - only has 1-2 pipes and no structure
  const cells = trimmed.split('|').filter(c => c.trim() !== '');
  if (cells.length < 2) return false;

  // Exclude separator rows (already valid)
  if (isSeparatorRow(trimmed)) return false;

  return true;
}

/**
 * Check if a line is a markdown table separator row (|---|---|---|)
 */
function isSeparatorRow(line: string): boolean {
  const cleaned = line.replace(/\|/g, '').replace(/[\s\-:]/g, '');
  return cleaned === '';
}

/**
 * Normalize a group of table-like lines into a proper markdown table.
 * If there's no separator row, insert one after the first row (assumed to be header).
 */
function normalizeTableLines(lines: string[]): string[] {
  if (lines.length < 2) return lines;

  // Check if there's already a separator row
  const hasSeparator = lines.some((line, idx) => idx > 0 && isSeparatorRow(line.trim()));

  if (hasSeparator) {
    // Already a valid table, return as-is
    return lines;
  }

  // Parse the first row to determine column count
  const headerCells = parseCells(lines[0]);
  const colCount = headerCells.length;

  // Generate separator row
  const separator = '|' + Array(colCount).fill('---').join('|') + '|';

  // Insert separator after first row
  return [lines[0], separator, ...lines.slice(1)];
}

/**
 * Parse cells from a table row line
 */
function parseCells(line: string): string[] {
  const trimmed = line.trim();
  // Remove leading and trailing |
  const inner = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
  const innerClean = inner.endsWith('|') ? inner.slice(0, -1) : inner;
  return innerClean.split('|');
}
