/**
 * Safe markdown rendering for chat: headings, lists, bold, italic, code, links.
 */

import { parseChatMarkdownBlocks } from "../lib/chatMarkdown.js";
import { isAllowedChatHref } from "../lib/chatLinkSecurity.js";
import { cn } from "../lib/utils.js";

function parseInline(text) {
  const nodes = [];
  const pattern = /(\[([^\]]+)\]\(([^)]+)\)|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    if (match[2] && match[3]) {
      nodes.push({ type: "link", label: match[2], href: match[3] });
    } else if (match[4]) nodes.push({ type: "bold", value: match[4] });
    else if (match[5]) nodes.push({ type: "italic", value: match[5] });
    else if (match[6]) nodes.push({ type: "code", value: match[6] });
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
      case "link": {
        const href = part.href.trim();
        if (!isAllowedChatHref(href)) {
          return <span key={index}>{part.label}</span>;
        }
        const external = /^https?:\/\//i.test(href);
        return (
          <a
            key={index}
            href={href}
            className="font-medium text-primary underline underline-offset-2"
            {...(external
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
          >
            {part.label}
          </a>
        );
      }
      default:
        return <span key={index}>{part.value}</span>;
    }
  });
}

function BlockContent({ block }) {
  if (block.type === "heading") {
    const Tag = block.level === 1 ? "h3" : block.level === 2 ? "h4" : "h5";
    return (
      <Tag className="mb-1 mt-3 font-semibold text-foreground first:mt-0">
        <InlineContent text={block.text} />
      </Tag>
    );
  }

  if (block.type === "ul" || block.type === "ol") {
    const ListTag = block.type === "ol" ? "ol" : "ul";
    return (
      <ListTag
        className={cnListClass(block.type)}
      >
        {block.items.map((item, index) => (
          <li key={index} className="leading-6">
            <InlineContent text={item} />
          </li>
        ))}
      </ListTag>
    );
  }

  return (
    <p className="leading-6">
      <InlineContent text={block.text} />
    </p>
  );
}

function cnListClass(type) {
  return type === "ol"
    ? "my-2 list-decimal space-y-1 pl-5"
    : "my-2 list-disc space-y-1 pl-5";
}

export default function FormattedChatText({ text, className }) {
  const blocks = parseChatMarkdownBlocks(text);

  return (
    <div className={cn("space-y-2 text-sm", className)}>
      {blocks.map((block, index) => (
        <BlockContent key={index} block={block} />
      ))}
    </div>
  );
}
