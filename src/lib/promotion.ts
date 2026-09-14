import type { PromotionTask, PromotionTaskRecord, PromotionStatus } from '@/types';

// 将 Date 格式化为 YYYY-MM-DD（本地时区）
export function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 计算两个日期（YYYY-MM-DD）之间相差的整天数（b - a）
function diffDays(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

// 判断某天任务是否处于生效周期内（不考虑启用状态）
export function isTaskActiveOnDate(task: PromotionTask, date: Date): boolean {
  const dateStr = formatDateStr(date);
  switch (task.cycle_type) {
    case '短期任务': {
      if (!task.start_date || !task.end_date) return false;
      return dateStr >= task.start_date && dateStr <= task.end_date;
    }
    case '周期任务': {
      if (!task.start_date || !task.cycle_interval || task.cycle_interval <= 0) return false;
      const days = diffDays(task.start_date, dateStr);
      return days >= 0 && days % task.cycle_interval === 0;
    }
    case '长期任务':
    default:
      return true;
  }
}

// 获取某天任务的推广截止时间（该天日期 + 推广时间）
function getDeadline(task: PromotionTask, date: Date): Date {
  const [h, m, s] = task.promotion_time.split(':').map(Number);
  const deadline = new Date(date);
  deadline.setHours(h || 0, m || 0, s || 0, 0);
  return deadline;
}

// 依据时间和完成情况动态计算推广状态（此状态不保存后端）
export function calcPromotionStatus(
  task: PromotionTask,
  date: Date,
  record?: PromotionTaskRecord | null
): PromotionStatus {
  if (record?.is_completed) return '已完成';
  const deadline = getDeadline(task, date);
  return new Date() < deadline ? '未完成' : '已错过';
}

// 判断某天是否可以设置任务完成状态（仅今天）
export function canSetCompletion(date: Date): boolean {
  return formatDateStr(date) === formatDateStr(new Date());
}
