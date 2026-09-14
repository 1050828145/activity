import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { createScheduledTask, updateScheduledTask } from '@/db/api';
import type { ScheduledTask, TaskType } from '@/types';
import CronEditor from './CronEditor';

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: ScheduledTask | null;
  onSuccess: () => void;
}

export default function TaskDialog({
  open,
  onOpenChange,
  task,
  onSuccess,
}: TaskDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    task_type: 'custom' as TaskType,
    cron_expression: '0 0 * * *',
    enabled: true,
  });

  useEffect(() => {
    if (task) {
      setFormData({
        name: task.name,
        description: task.description || '',
        task_type: task.task_type,
        cron_expression: task.cron_expression,
        enabled: task.enabled,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        task_type: 'custom',
        cron_expression: '0 0 * * *',
        enabled: true,
      });
    }
  }, [task, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (task) {
        await updateScheduledTask(task.id, formData);
        toast.success('任务更新成功');
      } else {
        await createScheduledTask(formData);
        toast.success('任务创建成功');
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? '编辑定时任务' : '新建定时任务'}</DialogTitle>
          <DialogDescription>
            配置定时任务的基本信息和执行时间
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">任务名称 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：每日数据备份"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">任务描述</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="描述任务的用途和功能"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task_type">任务类型 *</Label>
              <Select
                value={formData.task_type}
                onValueChange={(value: TaskType) => setFormData({ ...formData, task_type: value })}
              >
                <SelectTrigger id="task_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="send_email">发送邮件</SelectItem>
                  <SelectItem value="data_cleanup">数据清理</SelectItem>
                  <SelectItem value="report_generation">报表生成</SelectItem>
                  <SelectItem value="custom">自定义任务</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enabled">启用任务</Label>
                <p className="text-sm text-muted-foreground">
                  关闭后任务将不会执行
                </p>
              </div>
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
            </div>
          </div>

          <CronEditor
            value={formData.cron_expression}
            onChange={(value) => setFormData({ ...formData, cron_expression: value })}
          />

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '保存中...' : task ? '更新任务' : '创建任务'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
