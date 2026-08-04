import {memo} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Render a finding body or a round summary.
 *
 * The `pre`/`code` overrides are not cosmetic: review bodies quote real code,
 * and without them a long line pushes the whole layout sideways instead of
 * scrolling inside its own box.
 */
export const Markdown = memo(function Markdown({children}: {children: string}) {
  return (
    <div className="prose-review text-sm text-neutral-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: (props) => <pre {...props} className="overflow-x-auto whitespace-pre-wrap break-words" />,
          code: ({className, ...props}) => <code {...props} className={`${className ?? ''} break-words`} />,
          a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});
