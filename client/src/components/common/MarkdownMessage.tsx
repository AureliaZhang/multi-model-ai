import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { normalizeMarkdown } from '../../utils/markdown';

/**
 * Shared assistant-markdown renderer: react-markdown + remarkGfm +
 * normalizeMarkdown + the `.table-wrapper` table override — the single source of
 * truth for rendering assistant content (private chat + group-chat column c +
 * export). Callers keep their own `.markdown-content` wrapper (font sizing differs).
 */
export function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        table: ({ children, ...props }) => (
          <div className="table-wrapper"><table {...props}>{children}</table></div>
        ),
      }}
    >
      {normalizeMarkdown(content)}
    </ReactMarkdown>
  );
}
