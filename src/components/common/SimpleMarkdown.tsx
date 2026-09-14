import type { ReactNode } from 'react';

// 渲染行内格式：**加粗** 与 `代码`
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${i}`} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(
        <code
          key={`${keyPrefix}-c-${i}`}
          className="bg-muted px-1 py-0.5 rounded text-xs font-mono"
        >
          {token.slice(1, -1)}
        </code>,
      );
    }
    lastIndex = match.index + token.length;
    i++;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

interface SimpleMarkdownProps {
  content: string;
  className?: string;
}

// 极简 Markdown 渲染器（无第三方依赖），支持标题/加粗/列表/段落/代码
export default function SimpleMarkdown({ content, className }: SimpleMarkdownProps) {
  const lines = content.split('\n');
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let ordered = false;
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    const items = [...listItems];
    if (ordered) {
      blocks.push(
        <ol key={`ol-${key++}`} className="list-decimal pl-5 space-y-1 my-2">
          {items.map((t, idx) => (
            <li key={idx}>{renderInline(t, `li-${key}-${idx}`)}</li>
          ))}
        </ol>,
      );
    } else {
      blocks.push(
        <ul key={`ul-${key++}`} className="list-disc pl-5 space-y-1 my-2">
          {items.map((t, idx) => (
            <li key={idx}>{renderInline(t, `li-${key}-${idx}`)}</li>
          ))}
        </ul>,
      );
    }
    listItems = [];
  };

  lines.forEach((raw) => {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushList();
      return;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (heading) {
      flushList();
      const level = heading[1].length;
      const cls =
        level <= 1
          ? 'text-base font-bold mt-3 mb-1'
          : 'text-sm font-semibold mt-2 mb-1';
      blocks.push(
        <p key={`h-${key++}`} className={cls}>
          {renderInline(heading[2], `h-${key}`)}
        </p>,
      );
    } else if (bullet) {
      ordered = false;
      listItems.push(bullet[1]);
    } else if (numbered) {
      ordered = true;
      listItems.push(numbered[1]);
    } else {
      flushList();
      blocks.push(
        <p key={`p-${key++}`} className="my-1.5">
          {renderInline(line, `p-${key}`)}
        </p>,
      );
    }
  });
  flushList();

  return <div className={className}>{blocks}</div>;
}