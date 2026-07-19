/**
 * §10.6.13 Markdown → real .docx (OOXML) generator — pure JS, zero native deps.
 *
 * We deliberately do NOT use a heavyweight library (docx / html-to-docx pull in
 * native or huge trees). A .docx is just a ZIP of a few XML files; we build the
 * minimal set by hand and map markdown to native Word elements so the result
 * opens cleanly in Word AND WPS (no "format error"):
 *   - # / ## / ###        → bold, sized paragraphs (inline rPr, no style dep)
 *   - **bold** *italic*   → w:b / w:i runs
 *   - `code`              → monospace run
 *   - ``` fenced ```      → shaded monospace block
 *   - - / * / 1.          → bulleted / numbered paragraphs
 *   - | a | b |           → native w:tbl with borders
 *   - ---                 → horizontal rule (bottom-bordered empty paragraph)
 *
 * Everything is emitted as inline run properties so we don't depend on a
 * styles.xml defining named styles (a common source of WPS mismatches).
 */

// ----------------------- XML escaping -----------------------

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ----------------------- inline markdown → runs -----------------------

interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

/**
 * Parse a single line of inline markdown into styled runs.
 * Handles **bold**, *italic* / _italic_, `code`. Nesting is kept simple
 * (good enough for LLM prose; not a full CommonMark inline parser).
 */
function parseInline(text: string): Run[] {
  const runs: Run[] = [];
  let i = 0;
  let buf = '';
  const flush = (extra?: Partial<Run>) => {
    if (buf) {
      runs.push({ text: buf, ...extra });
      buf = '';
    }
  };

  while (i < text.length) {
    const two = text.slice(i, i + 2);
    // bold **...**
    if (two === '**') {
      const end = text.indexOf('**', i + 2);
      if (end !== -1) {
        flush();
        runs.push({ text: text.slice(i + 2, end), bold: true });
        i = end + 2;
        continue;
      }
    }
    // inline code `...`
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        flush();
        runs.push({ text: text.slice(i + 1, end), code: true });
        i = end + 1;
        continue;
      }
    }
    // italic *...* or _..._  (single delimiter, not part of **)
    if ((text[i] === '*' && two !== '**') || text[i] === '_') {
      const delim = text[i];
      const end = text.indexOf(delim, i + 1);
      if (end !== -1 && end > i + 1) {
        flush();
        runs.push({ text: text.slice(i + 1, end), italic: true });
        i = end + 1;
        continue;
      }
    }
    buf += text[i];
    i++;
  }
  flush();
  return runs.length ? runs : [{ text: '' }];
}

function runXml(r: Run): string {
  const rpr: string[] = [];
  if (r.bold) rpr.push('<w:b/>');
  if (r.italic) rpr.push('<w:i/>');
  if (r.code) {
    rpr.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>');
    rpr.push('<w:shd w:val="clear" w:color="auto" w:fill="F2F2F4"/>');
  }
  const rprXml = rpr.length ? `<w:rPr>${rpr.join('')}</w:rPr>` : '';
  // xml:space=preserve so leading/trailing spaces survive
  return `<w:r>${rprXml}<w:t xml:space="preserve">${esc(r.text)}</w:t></w:r>`;
}

function runsXml(runs: Run[]): string {
  return runs.map(runXml).join('');
}

// ----------------------- block builders -----------------------

/** A plain paragraph from inline markdown. */
function para(text: string): string {
  return `<w:p>${runsXml(parseInline(text))}</w:p>`;
}

/** Heading: level 1..6 → decreasing sizes, bold, space before/after. */
function heading(level: number, text: string): string {
  // half-points: h1=32(16pt) h2=28 h3=26 h4=24 h5=22 h6=21
  const sizes = [32, 28, 26, 24, 22, 21];
  const sz = sizes[Math.min(level, 6) - 1];
  const runs = parseInline(text).map((r) => ({ ...r, bold: true }));
  const inner = runs
    .map((r) => {
      const rpr = ['<w:b/>', `<w:sz w:val="${sz}"/>`, `<w:szCs w:val="${sz}"/>`];
      if (r.italic) rpr.push('<w:i/>');
      return `<w:r><w:rPr>${rpr.join('')}</w:rPr><w:t xml:space="preserve">${esc(r.text)}</w:t></w:r>`;
    })
    .join('');
  return `<w:p><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>${inner}</w:p>`;
}

/** List item paragraph (bullet or number rendered as literal prefix). */
function listItem(text: string, ordered: boolean, index: number): string {
  const prefix = ordered ? `${index}. ` : '• ';
  const runs = parseInline(text);
  const first = runs[0] || { text: '' };
  runs[0] = { ...first, text: prefix + first.text };
  return `<w:p><w:pPr><w:ind w:left="360"/></w:pPr>${runsXml(runs)}</w:p>`;
}

/** Fenced code block: each line a monospace run, shaded. */
function codeBlock(lines: string[]): string {
  const paras = lines.map((ln) => {
    const run = `<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${esc(ln)}</w:t></w:r>`;
    return `<w:p><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F6F6F8"/><w:spacing w:after="0"/></w:pPr>${run}</w:p>`;
  });
  return paras.join('');
}

/** Horizontal rule as a bottom-bordered empty paragraph. */
function hr(): string {
  return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="CCCCCC"/></w:pBdr></w:pPr></w:p>';
}

const CELL_BORDERS =
  '<w:tcBorders>' +
  '<w:top w:val="single" w:sz="4" w:space="0" w:color="D0D0D6"/>' +
  '<w:left w:val="single" w:sz="4" w:space="0" w:color="D0D0D6"/>' +
  '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="D0D0D6"/>' +
  '<w:right w:val="single" w:sz="4" w:space="0" w:color="D0D0D6"/>' +
  '</w:tcBorders>';

function tableCell(text: string, header: boolean): string {
  const runs = parseInline(text).map((r) => (header ? { ...r, bold: true } : r));
  const shd = header ? '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F4"/>' : '';
  return `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/>${CELL_BORDERS}${shd}</w:tcPr><w:p>${runsXml(runs)}</w:p></w:tc>`;
}

function tableRow(cells: string[], header: boolean): string {
  return `<w:tr>${cells.map((c) => tableCell(c, header)).join('')}</w:tr>`;
}

/** Build a w:tbl from parsed rows (first row = header, separator row dropped). */
function tableXml(rows: string[][]): string {
  if (rows.length === 0) return '';
  const cols = Math.max(...rows.map((r) => r.length));
  const grid = `<w:tblGrid>${Array(cols).fill('<w:gridCol w:w="2400"/>').join('')}</w:tblGrid>`;
  const tblPr =
    '<w:tblPr><w:tblW w:w="0" w:type="auto"/>' +
    '<w:tblBorders>' +
    '<w:top w:val="single" w:sz="4" w:space="0" w:color="D0D0D6"/>' +
    '<w:left w:val="single" w:sz="4" w:space="0" w:color="D0D0D6"/>' +
    '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="D0D0D6"/>' +
    '<w:right w:val="single" w:sz="4" w:space="0" w:color="D0D0D6"/>' +
    '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="D0D0D6"/>' +
    '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="D0D0D6"/>' +
    '</w:tblBorders></w:tblPr>';
  const body = rows
    .map((r, idx) => {
      const padded = r.slice();
      while (padded.length < cols) padded.push('');
      return tableRow(padded, idx === 0);
    })
    .join('');
  return `<w:tbl>${tblPr}${grid}${body}</w:tbl>`;
}

// ----------------------- table detection helpers -----------------------

function isTableRow(line: string): boolean {
  const t = line.trim();
  return t.includes('|') && (t.match(/\|/g) || []).length >= 2;
}

function isSeparatorRow(line: string): boolean {
  const cleaned = line.replace(/\|/g, '').replace(/[\s\-:]/g, '');
  return cleaned === '' && line.includes('-');
}

function parseCells(line: string): string[] {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((c) => c.trim());
}

// ----------------------- markdown → body XML -----------------------

/** Convert one markdown document into a sequence of block XML strings. */
function markdownBlocks(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // fenced code block
    if (trimmed.startsWith('```')) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing fence
      out.push(codeBlock(code));
      continue;
    }

    // blank line
    if (trimmed === '') {
      i++;
      continue;
    }

    // horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      out.push(hr());
      i++;
      continue;
    }

    // heading
    const h = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      out.push(heading(h[1].length, h[2]));
      i++;
      continue;
    }

    // table (need at least header + one more row that looks like a table)
    if (isTableRow(line) && i + 1 < lines.length && isTableRow(lines[i + 1])) {
      const tblLines: string[] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        tblLines.push(lines[i]);
        i++;
      }
      const rows = tblLines
        .filter((l) => !isSeparatorRow(l))
        .map(parseCells);
      out.push(tableXml(rows));
      continue;
    }

    // list (consecutive items)
    const bullet = trimmed.match(/^[-*+]\s+(.*)$/);
    const numbered = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      let n = 1;
      while (i < lines.length) {
        const lt = lines[i].trim();
        const b = lt.match(/^[-*+]\s+(.*)$/);
        const num = lt.match(/^(\d+)\.\s+(.*)$/);
        if (ordered && num) {
          out.push(listItem(num[2], true, n++));
          i++;
        } else if (!ordered && b) {
          out.push(listItem(b[1], false, n++));
          i++;
        } else {
          break;
        }
      }
      continue;
    }

    // plain paragraph
    out.push(para(trimmed));
    i++;
  }

  return out.join('');
}

// ----------------------- document assembly -----------------------

export interface DocxSection {
  /** Small grey meta line above the reply (e.g. "AI · model · time"). Optional. */
  meta?: string;
  /** The reply markdown. */
  markdown: string;
}

function metaPara(text: string): string {
  return `<w:p><w:pPr><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:color w:val="999999"/><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}

function buildDocumentXml(title: string, sections: DocxSection[]): string {
  const blocks: string[] = [];
  if (title) blocks.push(heading(1, title));

  sections.forEach((s, idx) => {
    if (idx > 0) blocks.push(hr());
    if (s.meta) blocks.push(metaPara(s.meta));
    blocks.push(markdownBlocks(s.markdown));
  });

  const sectPr =
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
    '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="720" w:footer="720" w:gutter="0"/>' +
    '</w:sectPr>';

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${blocks.join('')}${sectPr}</w:body>` +
    '</w:document>'
  );
}

// ----------------------- minimal ZIP (stored, no compression) -----------------------

const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Buffer;
}

/** Build a ZIP archive using stored (method 0) entries. */
function buildZip(entries: ZipEntry[]): Buffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const crc = crc32(e.data);
    const size = e.data.length;

    // Local file header (30 bytes + name)
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // method = stored
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0x21, 12); // mod date (1980-01-01-ish)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18); // compressed size
    local.writeUInt32LE(size, 22); // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra len

    chunks.push(local, nameBuf, e.data);

    // Central directory header (46 bytes + name)
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); // signature
    cen.writeUInt16LE(20, 4); // version made by
    cen.writeUInt16LE(20, 6); // version needed
    cen.writeUInt16LE(0, 8); // flags
    cen.writeUInt16LE(0, 10); // method
    cen.writeUInt16LE(0, 12); // mod time
    cen.writeUInt16LE(0x21, 14); // mod date
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(size, 20);
    cen.writeUInt32LE(size, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt16LE(0, 30); // extra len
    cen.writeUInt16LE(0, 32); // comment len
    cen.writeUInt16LE(0, 34); // disk number
    cen.writeUInt16LE(0, 36); // internal attrs
    cen.writeUInt32LE(0, 38); // external attrs
    cen.writeUInt32LE(offset, 42); // local header offset
    central.push(cen, nameBuf);

    offset += local.length + nameBuf.length + e.data.length;
  }

  const centralBuf = Buffer.concat(central);
  const centralOffset = offset;

  // End of central directory record (22 bytes)
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4); // disk
  end.writeUInt16LE(0, 6); // disk with central dir
  end.writeUInt16LE(entries.length, 8); // entries this disk
  end.writeUInt16LE(entries.length, 10); // total entries
  end.writeUInt32LE(centralBuf.length, 12); // central dir size
  end.writeUInt32LE(centralOffset, 16); // central dir offset
  end.writeUInt16LE(0, 20); // comment len

  return Buffer.concat([...chunks, centralBuf, end]);
}

// ----------------------- public API -----------------------

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '</Types>';

const ROOT_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '</Relationships>';

/**
 * Build a real .docx (OOXML) Buffer from a title + a list of markdown sections.
 * Opens cleanly in Word and WPS.
 */
export function markdownToDocx(title: string, sections: DocxSection[]): Buffer {
  const documentXml = buildDocumentXml(title, sections);
  return buildZip([
    { name: '[Content_Types].xml', data: Buffer.from(CONTENT_TYPES, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(ROOT_RELS, 'utf8') },
    { name: 'word/document.xml', data: Buffer.from(documentXml, 'utf8') },
  ]);
}
