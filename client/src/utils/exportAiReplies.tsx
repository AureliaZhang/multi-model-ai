import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownMessage } from '../components/common/MarkdownMessage';

/**
 * Export the group AI replies (assistant answers only) as .docx or .pdf.
 *
 * Both formats start from the SAME markdown → HTML rendering used in column c
 * (the shared <MarkdownMessage>), so what the user exports matches what they see:
 *   - PDF  : open a print window with a fixed light stylesheet and call print()
 *            (the user picks "Save as PDF"); pixel-faithful to column c.
 *   - docx : the raw markdown is sent to the server which builds a real OOXML
 *            .docx (see server/src/utils/markdownToDocx). This module only
 *            triggers the download; the heavy lifting is server-side.
 *
 * We only ever export `role === 'assistant'` rows with real content.
 */

export interface ExportableReply {
  content: string;
  modelUsed?: string | null;
  createdAt: string;
}

/** Render one assistant reply's markdown to an HTML string (column-c parity). */
function replyToHtml(content: string): string {
  return renderToStaticMarkup(<MarkdownMessage content={content} />);
}

/**
 * Self-contained light stylesheet for print/PDF. Intentionally does NOT use the
 * app's theme CSS variables — a print should always be black-on-white and legible
 * regardless of the in-app dark/light theme.
 */
const PRINT_CSS = `
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", Roboto, Helvetica, Arial, sans-serif;
    color: #1a1a1a;
    line-height: 1.7;
    max-width: 760px;
    margin: 0 auto;
    padding: 40px 32px;
    font-size: 14px;
  }
  h1, h2, h3, h4 { font-weight: 600; margin: 1.2em 0 0.5em; line-height: 1.3; }
  h1 { font-size: 1.6em; } h2 { font-size: 1.35em; } h3 { font-size: 1.15em; }
  p { margin: 0 0 0.7em; }
  ul, ol { padding-left: 1.6em; margin: 0 0 0.7em; }
  li { margin-bottom: 0.3em; }
  code {
    background: #f2f2f4; padding: 0.12em 0.4em; border-radius: 4px;
    font-family: "SFMono-Regular", Consolas, "Fira Code", monospace; font-size: 0.88em;
  }
  pre {
    background: #f6f6f8; border-radius: 8px; padding: 14px 16px; overflow-x: auto;
    margin: 0 0 0.8em;
  }
  pre code { background: none; padding: 0; }
  blockquote {
    border-left: 3px solid #d0d0d6; padding-left: 1em; margin: 0 0 0.7em; color: #555;
  }
  table { width: 100%; border-collapse: collapse; margin: 0.8em 0; font-size: 0.92em; }
  th, td { border: 1px solid #d0d0d6; padding: 0.45em 0.7em; text-align: left; vertical-align: top; }
  th { background: #f2f2f4; font-weight: 600; }
  .reply { margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid #ececf0; }
  .reply:last-child { border-bottom: none; }
  .reply-meta { font-size: 11px; color: #999; margin-bottom: 8px; }
  @media print {
    body { padding: 0; max-width: none; }
    .reply { page-break-inside: avoid; }
  }
`;

function metaLine(r: ExportableReply): string {
  const when = (() => {
    try {
      return new Date(r.createdAt).toLocaleString();
    } catch {
      return r.createdAt;
    }
  })();
  const model = r.modelUsed ? ` · ${r.modelUsed}` : '';
  return `AI${model} · ${when}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * PDF via the browser print pipeline. Opens a new window with the fixed light
 * stylesheet, writes each reply's rendered HTML, and calls print(). The user
 * chooses "Save as PDF" in the print dialog.
 */
export function exportRepliesAsPdf(replies: ExportableReply[], roomName: string): void {
  const win = window.open('', '_blank', 'width=820,height=900');
  if (!win) {
    alert('Popup blocked — allow popups to export PDF.');
    return;
  }
  const body = replies
    .map(
      (r) =>
        `<div class="reply"><div class="reply-meta">${escapeHtml(metaLine(r))}</div>${replyToHtml(r.content)}</div>`,
    )
    .join('\n');

  win.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(roomName)} — AI</title>
<style>${PRINT_CSS}</style>
</head>
<body>
${body}
<script>
  window.onload = function () {
    setTimeout(function () { window.print(); }, 200);
  };
</script>
</body>
</html>`);
  win.document.close();
}

/** Trigger a browser download for a Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Safe filename stem from the room name + timestamp. */
export function exportFilename(roomName: string, ext: string): string {
  const stem = (roomName || 'group').replace(/[^\w一-龥-]+/g, '_').slice(0, 40);
  const stamp = new Date().toISOString().slice(0, 10);
  return `${stem}_AI_${stamp}.${ext}`;
}
