import { Fragment, type ReactNode } from 'react';

/**
 * Renders the small Markdown subset the API's legal documents use: `##` headings,
 * paragraphs, `-` bullets and `**bold**`. A full Markdown library would be ~50 kB of
 * JavaScript for four constructs, on a screen every new user loads.
 *
 * Nothing here interprets raw HTML: the text is always inserted as text nodes, never
 * through `dangerouslySetInnerHTML`.
 */
export function Markdown({ source }: { source: string }) {
  const blocks = source.trim().split(/\n{2,}/);

  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block, index) => {
        const lines = block.split('\n');

        if (lines[0]?.startsWith('## ')) {
          return (
            <h2 key={index} className="text-base font-semibold">
              {inline(lines[0].slice(3))}
            </h2>
          );
        }

        if (lines.every((line) => line.startsWith('- ') || line.startsWith('  '))) {
          // Continuation lines (two-space indent) belong to the bullet above them.
          const items: string[] = [];
          for (const line of lines) {
            if (line.startsWith('- ')) items.push(line.slice(2));
            else if (items.length > 0) items[items.length - 1] += ` ${line.trim()}`;
          }
          return (
            <ul key={index} className="flex list-disc flex-col gap-1.5 pl-5">
              {items.map((item, itemIndex) => (
                <li key={itemIndex} className="text-sm leading-6 text-text-muted">
                  {inline(item)}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={index} className="text-sm leading-6 text-text-muted">
            {inline(block.replace(/\n/g, ' '))}
          </p>
        );
      })}
    </div>
  );
}

function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={index} className="font-semibold text-text">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}
