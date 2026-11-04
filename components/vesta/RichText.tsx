import { parseBlocks, parseInline, type Block } from "./parseRichText";

function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((part, i) =>
        part.kind === "bold" ? (
          <strong key={i} className="font-semibold text-text">
            {part.text}
          </strong>
        ) : part.kind === "code" ? (
          <code key={i} className="rounded bg-bg px-1 py-px font-mono text-[0.85em] text-ember-soft">
            {part.text}
          </code>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case "gap":
      return <div className="h-1.5" aria-hidden />;
    case "h":
      return (
        <h3 className="mt-1 font-head text-[13px] font-semibold tracking-wide text-ember-soft">
          <Inline text={block.text} />
        </h3>
      );
    case "ul":
      return (
        <ul className="list-disc space-y-0.5 pl-4 marker:text-ember">
          {block.items.map((item, i) => (
            <li key={i}>
              <Inline text={item} />
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol start={block.start} className="list-decimal space-y-0.5 pl-5 marker:font-mono marker:text-xs marker:text-ember">
          {block.items.map((item, i) => (
            <li key={i}>
              <Inline text={item} />
            </li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded border border-line">
          <table className="w-full text-left text-xs">
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r} className={r === 0 ? "bg-raised font-semibold" : "border-t border-line"}>
                  {row.map((cell, c) => (
                    <td key={c} className="whitespace-nowrap px-2 py-1">
                      <Inline text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return (
        <p>
          <Inline text={block.text} />
        </p>
      );
  }
}

/** Safe rendering of the Markdown models write: bold, code, headings, lists and tables. No HTML injection. */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {parseBlocks(text).map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </>
  );
}
