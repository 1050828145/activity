import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ActivityMultiSelect from './ActivityMultiSelect';
import type { Activity, PromotionTaskDetail, PromotionTaskDetailFormData } from '@/types';
import { toast } from 'sonner';

interface PromotionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail?: PromotionTaskDetail | null;
  notes?: string | null;
  activities: Activity[];
  defaultActivityIds?: string | null;
  onSubmit: (detail: PromotionTaskDetailFormData, notes: string | null) => Promise<void> | void;
}

function toLocalDateTimeInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PromotionDetailDialog({
  open,
  onOpenChange,
  detail,
  notes,
  activities,
  defaultActivityIds,
  onSubmit,
}: PromotionDetailDialogProps) {
  const [actualTime, setActualTime] = useState('');
  const [activityIds, setActivityIds] = useState('');
  const [channel, setChannel] = useState('');
  const [conversions, setConversions] = useState(0);
  const [noteText, setNoteText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActualTime(toLocalDateTimeInput(detail?.actual_time));
    setActivityIds(detail?.activity_ids || defaultActivityIds || '');
    setChannel(detail?.channel || '');
    setConversions(detail?.conversions ?? 0);
    setNoteText(notes || '');
  }, [open, detail, notes, defaultActivityIds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await onSubmit(
        {
          actual_time: actualTime ? new Date(actualTime).toISOString() : null,
          activity_ids: activityIds,
          channel: channel.trim(),
          conversions: Number.isFinite(conversions) ? Math.max(0, Math.floor(conversions)) : 0,
        },
        noteText.trim() || null
      );
    } catch (err) {
      console.error('保存推广详情失败:', err);
      toast.error('保存推广详情失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>实际推广详情</DialogTitle>
          <DialogDescription>填写本次推广的实际执行信息</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="actual-time">推广时间</Label>
            <Input
              id="actual-time"
              type="datetime-local"
              value={actualTime}
              onChange={(e) => setActualTime(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>推广活动</Label>
            <ActivityMultiSelect
              activities={activities}
              value={activityIds}
              onChange={setActivityIds}
              placeholder="选择推广活动（默认与任务活动列表相同）"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel">推广渠道</Label>
            <Input
              id="channel"
              placeholder="如：微信群、朋友圈、抖音等"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="conversions">转化人数</Label>
            <Input
              id="conversions"
              type="number"
              min={0}
              step={1}
              value={conversions}
              onChange={(e) => setConversions(e.target.value ? Number(e.target.value) : 0)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="detail-notes">备注</Label>
            <Textarea
              id="detail-notes"
              placeholder="备注信息（可选）"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// 工具：格式化实际推广时间用于展示
export function formatActualTime(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return format(d, 'yyyy-MM-dd HH:mm');
}