import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { createEmailNotification, updateEmailNotification } from '@/db/api';
import type { EmailNotification } from '@/types';

interface EmailNotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notification?: EmailNotification | null;
  onSuccess: () => void;
}

const contentTypeOptions = [
  { value: 'registrations', label: '今天的报名情况' },
  { value: 'todos', label: '今天的待办事项' },
  { value: 'notes', label: '备注信息' },
];

const weekDays = [
  { value: 0, label: '周日' },
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
];

export default function EmailNotificationDialog({
  open,
  onOpenChange,
  notification,
  onSuccess,
}: EmailNotificationDialogProps) {
  const [name, setName] = useState('');
  const [scheduleType, setScheduleType] = useState<'daily' | 'weekdays' | 'custom'>('daily');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [scheduleDays, setScheduleDays] = useState<number[]>([]);
  const [contentTypes, setContentTypes] = useState<string[]>(['registrations']);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (notification) {
        setName(notification.name);
        setScheduleType(notification.schedule_type);
        setScheduleTime(notification.schedule_time);
        setScheduleDays(notification.schedule_days || []);
        setContentTypes(notification.content_types);
      } else {
        setName('');
        setScheduleType('daily');
        setScheduleTime('09:00');
        setScheduleDays([]);
        setContentTypes(['registrations']);
      }
    }
  }, [open, notification]);

  const handleScheduleTypeChange = (value: string) => {
    setScheduleType(value as 'daily' | 'weekdays' | 'custom');
    if (value === 'weekdays') {
      setScheduleDays([1, 2, 3, 4, 5]); // 周一到周五
    } else if (value === 'daily') {
      setScheduleDays([0, 1, 2, 3, 4, 5, 6]); // 每天
    } else {
      setScheduleDays([]);
    }
  };

  const handleDayToggle = (day: number) => {
    setScheduleDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleContentTypeToggle = (type: string) => {
    setContentTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('请输入任务名称');
      return;
    }

    if (contentTypes.length === 0) {
      toast.error('请至少选择一种通知内容');
      return;
    }

    if (scheduleType === 'custom' && scheduleDays.length === 0) {
      toast.error('请至少选择一天');
      return;
    }

    try {
      setSaving(true);
      const data = {
        name: name.trim(),
        enabled: true,
        schedule_type: scheduleType,
        schedule_time: scheduleTime,
        schedule_days: scheduleType === 'custom' ? scheduleDays : undefined,
        content_types: contentTypes,
      };

      if (notification) {
        await updateEmailNotification(notification.id, data);
        toast.success('更新成功');
      } else {
        await createEmailNotification(data);
        toast.success('创建成功');
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('保存邮件通知任务失败:', error);
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{notification ? '编辑通知任务' : '新建通知任务'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 任务名称 */}
          <div className="space-y-2">
            <Label htmlFor="name">任务名称 *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：每日活动报告"
            />
          </div>

          {/* 发送时间 */}
          <div className="space-y-2">
            <Label htmlFor="time">发送时间 *</Label>
            <Input
              id="time"
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
            />
          </div>

          {/* 发送频率 */}
          <div className="space-y-3">
            <Label>发送频率 *</Label>
            <RadioGroup value={scheduleType} onValueChange={handleScheduleTypeChange}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="daily" id="daily" />
                <Label htmlFor="daily" className="font-normal cursor-pointer">
                  每天
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="weekdays" id="weekdays" />
                <Label htmlFor="weekdays" className="font-normal cursor-pointer">
                  工作日（周一至周五）
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="font-normal cursor-pointer">
                  自定义
                </Label>
              </div>
            </RadioGroup>

            {scheduleType === 'custom' && (
              <div className="pl-6 space-y-2">
                <Label>选择星期 *</Label>
                <div className="flex flex-wrap gap-2">
                  {weekDays.map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={scheduleDays.includes(day.value)}
                        onCheckedChange={() => handleDayToggle(day.value)}
                      />
                      <Label
                        htmlFor={`day-${day.value}`}
                        className="font-normal cursor-pointer"
                      >
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 通知内容 */}
          <div className="space-y-3">
            <Label>通知内容 *</Label>
            <div className="space-y-2">
              {contentTypeOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={option.value}
                    checked={contentTypes.includes(option.value)}
                    onCheckedChange={() => handleContentTypeToggle(option.value)}
                  />
                  <Label htmlFor={option.value} className="font-normal cursor-pointer">
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
