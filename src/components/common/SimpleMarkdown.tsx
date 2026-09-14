import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Calendar, Clock, Tag } from 'lucide-react';

export interface RecommendedTaskData {
  name: string;
  promotion_time?: string;
  cycle_type?: '长期任务' | '短期任务' | '周期任务';
  activity_names?: string;
  activity_list?: string;
  start_date?: string;
  end_date?: string;
  cycle_interval?: number | null;
  notes?: string;
}

// 渲染行内格式：**加粗** 与 `代码` 与行内 [生成任务: {...}]
function renderInline(
  text: string,
  keyPrefix: string,
  onGenerateTask?: (task: RecommendedTaskData) => void
): ReactNode[] {
  const nodes: ReactNode[] = [];
  // 匹配行内任务按钮标记：[GEN_TASK: {...}] 或 [生成任务: {...}] 或 **加粗** 或 `代码`
  const regex = /(\[GEN_TASK:\s*(\{[\s\S]*?\})\]|\[生成任务:\s*(\{[\s\S]*?\})\]|\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('[GEN_TASK:') || token.startsWith('[生成任务:')) {
      const jsonStr = match[2] || match[3];
      try {
        const taskData = JSON.parse(jsonStr) as RecommendedTaskData;
        nodes.push(
          <Button
            key={`${keyPrefix}-taskbtn-${i}`}
            size="sm"
            variant="default"
            className="h-6 text-xs px-2 ml-2 inline-flex items-center gap-1 align-middle"
            onClick={() => onGenerateTask?.(taskData)}
          >
            <Sparkles className="h-3 w-3" />
            生成任务
          </Button>
        );
      } catch {
        nodes.push(token);
      }
    } else if (token.startsWith('**')) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${i}`} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      nodes.push(
        <code
          key={`${keyPrefix}-c-${i}`}
          className="bg-muted px-1 py-0.5 rounded text-xs font-mono"
        >
          {token.slice(1, -1)}
        </code>
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
  onGenerateTask?: (task: RecommendedTaskData) => void;
}

// 极简 Markdown 渲染器（支持代码块、标题、加粗、列表、段落，以及专用的任务推荐卡片和生成任务按钮）
export default function SimpleMarkdown({
  content,
  className,
  onGenerateTask,
}: SimpleMarkdownProps) {
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
        <ol key={`ol-${key++}`} className="list-decimal pl-5 space-y-1.5 my-2">
          {items.map((t, idx) => (
            <li key={idx}>{renderInline(t, `li-${key}-${idx}`, onGenerateTask)}</li>
          ))}
        </ol>
      );
    } else {
      blocks.push(
        <ul key={`ul-${key++}`} className="list-disc pl-5 space-y-1.5 my-2">
          {items.map((t, idx) => (
            <li key={idx}>{renderInline(t, `li-${key}-${idx}`, onGenerateTask)}</li>
          ))}
        </ul>
      );
    }
    listItems = [];
  };

  let inCodeBlock = false;
  let codeLang = '';
  let codeLines: string[] = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const raw = lines[lineIdx];
    const trimmed = raw.trim();

    // 代码块起止标记
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        flushList();
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim().toLowerCase();
        codeLines = [];
        continue;
      } else {
        inCodeBlock = false;
        const codeText = codeLines.join('\n');

        // 判断是否为任务推荐结构
        let isTask =
          codeLang === 'task' ||
          codeLang === 'json:task' ||
          codeLang === 'recommended_task';
        let parsedTask: RecommendedTaskData | null = null;

        if (codeText.trim().startsWith('{') && codeText.trim().endsWith('}')) {
          try {
            const parsed = JSON.parse(codeText);
            if (parsed.name && (parsed.promotion_time || parsed.cycle_type || isTask)) {
              parsedTask = parsed as RecommendedTaskData;
              isTask = true;
            }
          } catch {
            // not valid JSON
          }
        }

        if (isTask && parsedTask) {
          const task = parsedTask;
          blocks.push(
            <div
              key={`task-card-${key++}`}
              className="my-3 rounded-lg border border-primary/20 bg-primary/5 p-3.5 shadow-sm transition-all hover:border-primary/40"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-primary" />
                      {task.name}
                    </span>
                    {task.cycle_type && (
                      <Badge variant="outline" className="text-xs">
                        {task.cycle_type}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {task.promotion_time && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        推广时间：{task.promotion_time}
                      </span>
                    )}
                    {task.activity_names && (
                      <span className="inline-flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        关联活动：{task.activity_names}
                      </span>
                    )}
                    {(task.start_date || task.end_date) && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        生效范围：{task.start_date || '即日'} 至 {task.end_date || '长期'}
                      </span>
                    )}
                  </div>
                  {task.notes && (
                    <p className="text-xs text-muted-foreground pt-1 italic">
                      建议理由：{task.notes}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  className="shrink-0 self-start sm:self-center bg-primary hover:bg-primary/90 text-primary-foreground text-xs shadow-sm"
                  onClick={() => onGenerateTask?.(task)}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  生成任务
                </Button>
              </div>
            </div>
          );
        } else {
          // 普通代码块
          blocks.push(
            <pre
              key={`code-${key++}`}
              className="my-2 rounded bg-muted p-3 text-xs font-mono overflow-x-auto text-foreground"
            >
              <code>{codeText}</code>
            </pre>
          );
        }
        continue;
      }
    }

    if (inCodeBlock) {
      codeLines.push(raw);
      continue;
    }

    const line = raw.trimEnd();
    if (!line.trim()) {
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);

    if (heading) {
      flushList();
      const level = heading[1].length;
      const cls =
        level <= 1
          ? 'text-base font-bold mt-4 mb-2 pb-1 border-b'
          : level === 2
          ? 'text-sm font-semibold mt-3 mb-1.5 text-primary'
          : 'text-sm font-medium mt-2 mb-1';
      blocks.push(
        <p key={`h-${key++}`} className={cls}>
          {renderInline(heading[2], `h-${key}`, onGenerateTask)}
        </p>
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
          {renderInline(line, `p-${key}`, onGenerateTask)}
        </p>
      );
    }
  }

  flushList();

  return <div className={className}>{blocks}</div>;
}
