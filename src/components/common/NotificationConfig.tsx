import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Bell, Send } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';

interface NotificationConfigProps {
  pageType: 'analytics' | 'data-product'; // 页面类型
  pageName: string; // 页面名称
  contentGetter: () => Promise<string>; // 获取要发送的内容
}

export function NotificationConfig({
  pageType,
  pageName,
  contentGetter,
}: NotificationConfigProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // 通知方式
  const [notificationMethod, setNotificationMethod] = useState<string>('email');

  // 发送方式
  const [sendMethod, setSendMethod] = useState<'immediate' | 'scheduled'>('immediate');

  // 定时发送配置
  const [taskName, setTaskName] = useState<string>('');
  const [sendFrequency, setSendFrequency] = useState<string>('daily');
  const [sendTime, setSendTime] = useState<string>('09:00');
  const [customDays, setCustomDays] = useState<number[]>([]);

  // 立即发送
  const handleImmediateSend = async () => {
    try {
      setLoading(true);

      console.log('开始获取内容...');
      // 获取内容
      const content = await contentGetter();
      console.log('内容获取成功，长度:', content.length);

      if (notificationMethod === 'email') {
        // 获取当前用户的邮箱
        console.log('获取当前用户信息...');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('未登录，无法发送邮件');
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', user.id)
          .maybeSingle();

        const userEmail = (profile as any)?.email;
        console.log('用户邮箱:', userEmail);

        if (!userEmail) {
          toast.error('请先在用户中心绑定邮箱');
          return;
        }

        console.log('调用 send-email Edge Function...');
        // 调用邮箱发送 Edge Function
        const { data, error } = await supabase.functions.invoke('send-email', {
          body: {
            subject: `${pageName} - 数据报告`,
            content,
            to_email: userEmail, // 传递用户邮箱
          },
        });

        console.log('Edge Function 响应:', { data, error });

        if (error) {
          console.error('Edge Function 错误:', error);
          let errorMsg = error.message;
          try {
            const errorText = await error?.context?.text();
            if (errorText) errorMsg = errorText;
          } catch (e) {
            console.error('无法读取错误详情:', e);
          }
          throw new Error(errorMsg);
        }

        if (data && !data.success) {
          console.error('发送失败:', data);
          throw new Error(data.error || '发送失败');
        }

        console.log('邮件发送成功');
        toast.success('邮件发送成功！请检查收件箱');
      } else {
        toast.error('暂不支持该通知方式');
      }

      setOpen(false);
    } catch (error: any) {
      console.error('发送失败:', error);
      toast.error(error.message || '发送失败');
    } finally {
      setLoading(false);
    }
  };

  // 创建定时任务
  const handleScheduledSend = async () => {
    try {
      setLoading(true);

      if (!taskName.trim()) {
        toast.error('请输入任务名称');
        return;
      }

      // 获取当前用户
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('未登录，无法创建定时任务');
      }

      // 生成 cron 表达式
      let cronExpression = '';
      const [hour, minute] = sendTime.split(':');

      if (sendFrequency === 'daily') {
        cronExpression = `0 ${minute} ${hour} * * *`;
      } else if (sendFrequency === 'weekdays') {
        cronExpression = `0 ${minute} ${hour} * * 1-5`;
      } else if (sendFrequency === 'custom' && customDays.length > 0) {
        const days = customDays.sort().join(',');
        cronExpression = `0 ${minute} ${hour} * * ${days}`;
      } else {
        toast.error('请选择发送频率');
        return;
      }

      // 创建定时任务
      const taskData: any = {
        name: taskName,
        description: `${pageName} - 定时发送`,
        task_type: notificationMethod === 'email' ? 'email_notification' : 'sms_notification',
        cron_expression: cronExpression,
        task_config: {
          page_type: pageType,
          page_name: pageName,
          notification_method: notificationMethod,
        },
        enabled: true,
        created_by: user.id, // 设置创建者
      };

      const { error } = await supabase.from('scheduled_tasks').insert(taskData);

      if (error) {
        throw error;
      }

      toast.success('定时任务创建成功');
      setOpen(false);

      // 重置表单
      setTaskName('');
      setSendFrequency('daily');
      setSendTime('09:00');
      setCustomDays([]);
    } catch (error: any) {
      console.error('创建定时任务失败:', error);
      toast.error(error.message || '创建定时任务失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (sendMethod === 'immediate') {
      handleImmediateSend();
    } else {
      handleScheduledSend();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Bell className="h-4 w-4 mr-2" />
          通知配置
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>通知配置</DialogTitle>
          <DialogDescription>
            配置数据报告的通知方式和发送时间
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 通知方式 */}
          <div className="space-y-2">
            <Label>通知方式</Label>
            <Select value={notificationMethod} onValueChange={setNotificationMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">邮箱通知</SelectItem>
                <SelectItem value="sms" disabled>短信通知（暂未开放）</SelectItem>
                <SelectItem value="wechat" disabled>微信通知（暂未开放）</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 发送方式 */}
          <div className="space-y-2">
            <Label>发送方式</Label>
            <Select value={sendMethod} onValueChange={(v) => setSendMethod(v as 'immediate' | 'scheduled')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">立即发送</SelectItem>
                <SelectItem value="scheduled">定时发送</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 定时发送配置 */}
          {sendMethod === 'scheduled' && (
            <>
              <div className="space-y-2">
                <Label>任务名称</Label>
                <Input
                  placeholder="例如：每日数据报告"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>发送频率</Label>
                <Select value={sendFrequency} onValueChange={setSendFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">每天</SelectItem>
                    <SelectItem value="weekdays">工作日（周一至周五）</SelectItem>
                    <SelectItem value="custom">自定义</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {sendFrequency === 'custom' && (
                <div className="space-y-2">
                  <Label>选择星期</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: '周一', value: 1 },
                      { label: '周二', value: 2 },
                      { label: '周三', value: 3 },
                      { label: '周四', value: 4 },
                      { label: '周五', value: 5 },
                      { label: '周六', value: 6 },
                      { label: '周日', value: 0 },
                    ].map((day) => (
                      <div key={day.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`day-${day.value}`}
                          checked={customDays.includes(day.value)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setCustomDays([...customDays, day.value]);
                            } else {
                              setCustomDays(customDays.filter((d) => d !== day.value));
                            }
                          }}
                        />
                        <label
                          htmlFor={`day-${day.value}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {day.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>发送时间</Label>
                <Input
                  type="time"
                  value={sendTime}
                  onChange={(e) => setSendTime(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              '处理中...'
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {sendMethod === 'immediate' ? '立即发送' : '创建定时任务'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
