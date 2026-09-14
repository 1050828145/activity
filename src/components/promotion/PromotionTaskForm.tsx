import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { getActivities } from '@/db/api';
import type { PromotionTask, PromotionTaskFormData, Activity, PromotionCycleType } from '@/types';
import { toast } from 'sonner';
import ActivityMultiSelect from './ActivityMultiSelect';

interface PromotionTaskFormProps {
  task?: PromotionTask;
  initialData?: Partial<PromotionTaskFormData> & { activity_names?: string };
  onSubmit: (data: PromotionTaskFormData) => Promise<void> | void;
  onCancel: () => void;
}

export default function PromotionTaskForm({
  task,
  initialData,
  onSubmit,
  onCancel,
}: PromotionTaskFormProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [formData, setFormData] = useState<PromotionTaskFormData>({
    name: task?.name || initialData?.name || '',
    is_common: task?.is_common ?? initialData?.is_common ?? false,
    activity_list: task?.activity_list || initialData?.activity_list || '',
    cycle_type: task?.cycle_type || initialData?.cycle_type || '长期任务',
    start_date: task?.start_date || initialData?.start_date || '',
    end_date: task?.end_date || initialData?.end_date || '',
    cycle_interval: task?.cycle_interval ?? initialData?.cycle_interval ?? null,
    promotion_time: task?.promotion_time || initialData?.promotion_time || '09:00:00',
    status: task?.status || initialData?.status || '启用',
    notes: task?.notes || initialData?.notes || '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (task) {
      setFormData({
        name: task.name,
        is_common: task.is_common,
        activity_list: task.activity_list,
        cycle_type: task.cycle_type,
        start_date: task.start_date || '',
        end_date: task.end_date || '',
        cycle_interval: task.cycle_interval ?? null,
        promotion_time: task.promotion_time,
        status: task.status,
        notes: task.notes || '',
      });
    } else if (initialData) {
      setFormData((prev) => ({
        ...prev,
        ...initialData,
      }));
    }
  }, [task, initialData]);

  // 当活动列表加载后，如果 initialData 带有活动名称但没有 activity_list，自动匹配关联活动
  useEffect(() => {
    if (initialData?.activity_names && activities.length > 0 && !task) {
      const names = initialData.activity_names
        .split(/[、,，]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const matchedIds = activities
        .filter((a) => names.some((n) => a.name.includes(n) || n.includes(a.name)))
        .map((a) => a.id);
      if (matchedIds.length > 0) {
        setFormData((prev) => {
          if (!prev.activity_list) {
            return { ...prev, activity_list: matchedIds.join(',') };
          }
          return prev;
        });
      }
    }
  }, [activities, initialData, task]);

  useEffect(() => {
    (async () => {
      try {
        const data = await getActivities();
        setActivities(data);
      } catch (error) {
        console.error('加载活动列表失败:', error);
        toast.error('加载活动列表失败');
      } finally {
        setLoadingActivities(false);
      }
    })();
  }, []);

  const handleCycleTypeChange = (value: PromotionCycleType) => {
    // 切换周期类型时清空对应的日期配置
    setFormData({
      ...formData,
      cycle_type: value,
      start_date: '',
      end_date: '',
      cycle_interval: null,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    // 周期类型校验
    if (formData.cycle_type === '短期任务' && (!formData.start_date || !formData.end_date)) {
      toast.error('短期任务需填写开始日期和结束日期');
      return;
    }
    if (formData.cycle_type === '周期任务' && (!formData.start_date || !formData.cycle_interval || formData.cycle_interval <= 0)) {
      toast.error('周期任务需填写起始日期和有效的执行间隔天数');
      return;
    }
    try {
      setSubmitting(true);
      await onSubmit({
        ...formData,
        name: formData.name.trim(),
        // 通用=是 时不指定活动列表
        activity_list: formData.is_common ? '' : formData.activity_list,
        // 长期任务清空日期配置
        start_date: formData.cycle_type === '长期任务' ? null : formData.start_date || null,
        end_date: formData.cycle_type === '短期任务' ? formData.end_date || null : null,
        cycle_interval: formData.cycle_type === '周期任务' ? formData.cycle_interval : null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="task-name">任务名称</Label>
        <Input
          id="task-name"
          placeholder="请输入任务名称"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>周期类型</Label>
        <Select value={formData.cycle_type} onValueChange={handleCycleTypeChange}>
          <SelectTrigger>
            <SelectValue placeholder="选择周期类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="短期任务">短期任务（指定日期范围）</SelectItem>
            <SelectItem value="周期任务">周期任务（每隔几天执行）</SelectItem>
            <SelectItem value="长期任务">长期任务（每天生效）</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.cycle_type === '短期任务' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="start-date">开始日期</Label>
            <Input
              id="start-date"
              type="date"
              value={formData.start_date || ''}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end-date">结束日期</Label>
            <Input
              id="end-date"
              type="date"
              value={formData.end_date || ''}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              required
            />
          </div>
        </div>
      )}

      {formData.cycle_type === '周期任务' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="cycle-start">起始日期</Label>
            <Input
              id="cycle-start"
              type="date"
              value={formData.start_date || ''}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cycle-interval">执行间隔（天）</Label>
            <Input
              id="cycle-interval"
              type="number"
              min={1}
              step={1}
              placeholder="每隔几天执行一次"
              value={formData.cycle_interval ?? ''}
              onChange={(e) =>
                setFormData({ ...formData, cycle_interval: e.target.value ? Number(e.target.value) : null })
              }
              required
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between space-x-2">
        <div>
          <Label htmlFor="is-common">通用</Label>
          <p className="text-xs text-muted-foreground">开启后不指定活动列表，适用于所有推广</p>
        </div>
        <Switch
          id="is-common"
          checked={formData.is_common}
          onCheckedChange={(checked) => setFormData({ ...formData, is_common: checked })}
        />
      </div>

      {!formData.is_common && (
        <div className="space-y-2">
          <Label htmlFor="activity-list">活动列表</Label>
          {loadingActivities ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <ActivityMultiSelect
              activities={activities}
              value={formData.activity_list || ''}
              onChange={(value) => setFormData({ ...formData, activity_list: value })}
              placeholder="选择要推广的活动"
            />
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="promotion-time">推广时间</Label>
        <Input
          id="promotion-time"
          type="time"
          value={formData.promotion_time.slice(0, 5)}
          onChange={(e) => setFormData({ ...formData, promotion_time: `${e.target.value}:00` })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>状态</Label>
        <Select
          value={formData.status}
          onValueChange={(value) => setFormData({ ...formData, status: value as '启用' | '停用' })}
        >
          <SelectTrigger>
            <SelectValue placeholder="选择状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="启用">启用</SelectItem>
            <SelectItem value="停用">停用（不展示在每日任务中）</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="task-notes">备注</Label>
        <Textarea
          id="task-notes"
          placeholder="备注信息（可选）"
          value={formData.notes || ''}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          取消
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? '保存中...' : '保存'}
        </Button>
      </div>
    </form>
  );
}
