import { useState, useEffect } from 'react';
import { X, Send, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { getUserProfile } from '@/db/api';

interface TestEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TestEmailDialog({
  open,
  onOpenChange,
}: TestEmailDialogProps) {
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState('测试邮件报告 - 正式流程模拟');
  const [content, setContent] = useState('<p>这是一次模拟正式邮件发送流程的测试。系统将自动采集今日的报名、待办和备注数据，并渲染成正式格式的邮件报告进行预览。</p>');
  const [testing, setTesting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    if (open) {
      loadUserEmail();
      setLogs([]);
      setTestResult(null);
    }
  }, [open]);

  const loadUserEmail = async () => {
    try {
      const profile = await getUserProfile();
      if (profile?.email) {
        setToEmail(profile.email);
      }
    } catch (error) {
      console.error('加载用户邮箱失败:', error);
    }
  };

  const handleTest = async () => {
    if (!toEmail.trim()) {
      toast.error('请输入收件人邮箱');
      return;
    }

    if (!subject.trim()) {
      toast.error('请输入邮件主题');
      return;
    }

    if (!content.trim()) {
      toast.error('请输入邮件内容');
      return;
    }

    try {
      setTesting(true);
      setLogs(['正在发送测试邮件...']);
      setTestResult(null);

      const { data, error } = await supabase.functions.invoke('test-email', {
        body: {
          to_email: toEmail.trim(),
          subject: subject.trim(),
          content: content.trim(),
        },
      });

      if (error) {
        // 尝试获取更详细的错误消息
        let errorMsg = error.message;
        let details = '';
        try {
          const body = await error.context.json();
          errorMsg = body.error || errorMsg;
          details = body.details || '';
          if (body.debug) {
             console.log('调试信息:', body.debug);
          }
        } catch (e) {
          try {
            errorMsg = await error.context.text();
          } catch (e2) {}
        }
        
        const fullMsg = details ? `${errorMsg} (${details})` : errorMsg;
        console.error('测试邮件发送失败:', fullMsg);
        setLogs(prev => [...prev, `❌ 错误: ${fullMsg}`]);
        
        // 检查是否是域名未验证错误
        if (fullMsg.includes('domain is not verified') || fullMsg.includes('validation_error')) {
          setLogs(prev => [...prev, '']);
          setLogs(prev => [...prev, '💡 解决方案：']);
          setLogs(prev => [...prev, '1. 使用 Resend 测试域名：onboarding@resend.dev']);
          setLogs(prev => [...prev, '2. 或在 https://resend.com/domains 验证您的域名']);
          setLogs(prev => [...prev, '']);
          setLogs(prev => [...prev, '⚠️ 注意：QQ、Gmail 等公共邮箱域名无法验证，请使用自己的域名或测试域名']);
        }
        
        setTestResult('error');
        toast.error(`测试失败: ${errorMsg}`);
        return;
      }

      if (data?.logs) {
        setLogs(data.logs);
      }

      if (data?.success) {
        setTestResult('success');
        toast.success('测试完成！');
      } else {
        setTestResult('error');
        toast.error(data?.error || '测试失败');
      }
    } catch (error: any) {
      console.error('测试邮件发送失败:', error);
      setLogs(prev => [...prev, `❌ 错误: ${error.message}`]);
      setTestResult('error');
      toast.error('测试失败');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>测试邮件发送</DialogTitle>
          <DialogDescription>
            发送一封测试邮件，验证邮件配置是否正确
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* 收件人 */}
          <div className="space-y-2">
            <Label htmlFor="to-email">收件人邮箱 *</Label>
            <Input
              id="to-email"
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="请输入收件人邮箱"
              disabled={testing}
            />
          </div>

          {/* 邮件主题 */}
          <div className="space-y-2">
            <Label htmlFor="subject">邮件主题 *</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="请输入邮件主题"
              disabled={testing}
            />
          </div>

          {/* 邮件内容 */}
          <div className="space-y-2">
            <Label htmlFor="content">邮件内容 *</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="请输入邮件内容（支持HTML）"
              rows={6}
              disabled={testing}
            />
            <p className="text-sm text-muted-foreground">
              支持HTML格式，例如：&lt;h2&gt;标题&lt;/h2&gt; &lt;p&gt;段落&lt;/p&gt;
            </p>
          </div>

          {/* 测试日志 */}
          {logs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>测试日志</Label>
                {testResult === 'success' && (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
                {testResult === 'error' && (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
              </div>
              <ScrollArea className="h-64 w-full rounded-md border border-border bg-muted/50 p-4">
                <div className="space-y-1 font-mono text-sm">
                  {logs.map((log, index) => (
                    <div
                      key={index}
                      className={`${
                        log.includes('❌')
                          ? 'text-destructive'
                          : log.includes('✅')
                          ? 'text-green-600 dark:text-green-400'
                          : log.includes('⚠️')
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : log.includes('💡')
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-foreground'
                      }`}
                    >
                      {log}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={testing}>
            <X className="h-4 w-4 mr-2" />
            关闭
          </Button>
          <Button onClick={handleTest} disabled={testing}>
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                测试中...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                发送测试邮件
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
