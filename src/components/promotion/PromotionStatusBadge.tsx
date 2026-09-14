import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PromotionStatus } from '@/types';

const statusConfig: Record<PromotionStatus, { icon: typeof CheckCircle2; label: string; className: string }> = {
  '已完成': { icon: CheckCircle2, label: '已完成', className: 'text-green-600 dark:text-green-400' },
  '未完成': { icon: Clock, label: '未完成', className: 'text-blue-600 dark:text-blue-400' },
  '已错过': { icon: XCircle, label: '已错过', className: 'text-destructive' },
};

// 依据推广状态展示图标（此图标由前端动态计算，不保存后端）
export function PromotionStatusBadge({ status, className }: { status: PromotionStatus; className?: string }) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-sm font-medium', config.className, className)}>
      <Icon className="h-4 w-4 shrink-0" />
      {config.label}
    </span>
  );
}
