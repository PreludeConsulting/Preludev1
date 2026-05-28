/**
 * Renders simple inline markdown in chat: **bold**, *italic*, `code`.
 */

function parseInline(text) {
  const nodes = [];
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    if (match[2]) nodes.push({ type: "bold", value: match[2] });
    else if (match[3]) nodes.push({ type: "italic", value: match[3] });
    else if (match[4]) nodes.push({ type: "code", value: match[4] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push({ type: "text", value: text.slice(lastIndex) });
  }

  return nodes.length ? nodes : [{ type: "text", value: text }];
}

function InlineContent({ text }) {
  return parseInline(text).map((part, index) => {
    switch (part.type) {
      case "bold":
        return (
          <strong key={index} className="font-semibold text-foreground">
            {part.value}
          </strong>
        );
      case "italic":
        return (
          <em key={index} className="text-foreground/90">
            {part.value}
          </em>
        );
      case "code":
        return (
          <code
            key={index}
            className="rounded bg-foreground/[0.06] px-1 py-0.5 font-mono text-[0.85em]"
          >
            {part.value}
          </code>
        );
      default:
        return <span key={index}>{part.value}</span>;
    }
  });
}

export default function FormattedChatText({ text, className }) {
  const lines = text.split("\n");

  return (
    <div className={className}>
      {lines.map((line, lineIndex) => (
        <p key={lineIndex} className={lineIndex > 0 ? "mt-2" : undefined}>
          <InlineContent text={line} />
        </p>
      ))}
    </div>
  );
}
