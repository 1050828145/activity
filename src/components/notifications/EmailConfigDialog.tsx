import { useState, useEffect } from 'react';
import { X, Save, Loader2, Eye, EyeOff, ExternalLink } from 'lucide-react';
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
import { toast } from 'sonner';
import { getEmailConfig, saveEmailConfig } from '@/db/api';

interface EmailConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EmailConfigDialog({
  open,
  onOpenChange,
}: EmailConfigDialogProps) {
  const [resendApiKey, setResendApiKey] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('活动与人员管理系统');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (open) {
      loadConfig();
    }
  }, [open]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const config = await getEmailConfig();
      if (config) {
        setResendApiKey(config.resend_api_key);
        setFromEmail(config.from_email);
        setFromName(config.from_name);
      }
    } catch (error) {
      console.error('加载邮箱配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!resendApiKey.trim()) {
      toast.error('请输入 Resend API Key');
      return;
    }

    if (!fromEmail.trim()) {
      toast.error('请输入发件人邮箱');
      return;
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(fromEmail)) {
      toast.error('请输入有效的邮箱地址');
      return;
    }

    if (!fromName.trim()) {
      toast.error('请输入发件人名称');
      return;
    }

    try {
      setSaving(true);
      await saveEmailConfig({
        resend_api_key: resendApiKey.trim(),
        from_email: fromEmail.trim(),
        from_name: fromName.trim(),
      });
      toast.success('邮箱配置保存成功');
      onOpenChange(false);
    } catch (error: any) {
      console.error('保存邮箱配置失败:', error);
      toast.error(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>邮箱配置</DialogTitle>
          <DialogDescription>
            配置 Resend 邮件服务，用于发送系统通知邮件
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Resend API Key */}
            <div className="space-y-2">
              <Label htmlFor="resend-api-key">Resend API Key *</Label>
              <div className="relative">
                <Input
                  id="resend-api-key"
                  type={showApiKey ? 'text' : 'password'}
                  value={resendApiKey}
                  onChange={(e) => setResendApiKey(e.target.value)}
                  placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxx"
                  disabled={saving}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                在 <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                  Resend 控制台 <ExternalLink className="h-3 w-3" />
                </a> 创建 API Key
              </p>
            </div>

            {/* 发件人邮箱 */}
            <div className="space-y-2">
              <Label htmlFor="from-email">发件人邮箱 *</Label>
              <Input
                id="from-email"
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="onboarding@resend.dev"
                disabled={saving}
              />
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  需要在 <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                    Resend 控制台 <ExternalLink className="h-3 w-3" />
                  </a> 验证域名后才能发送邮件
                </p>
                <p className="text-sm font-medium text-amber-600 dark:text-amber-500">
                  💡 快速开始：使用测试域名 <code className="px-1.5 py-0.5 bg-muted rounded text-xs">onboarding@resend.dev</code>
                </p>
                <p className="text-sm text-muted-foreground">
                  ⚠️ 注意：QQ、Gmail 等公共邮箱域名无法验证，需使用自己的域名
                </p>
              </div>
            </div>

            {/* 发件人名称 */}
            <div className="space-y-2">
              <Label htmlFor="from-name">发件人名称 *</Label>
              <Input
                id="from-name"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="活动与人员管理系统"
                disabled={saving}
              />
              <p className="text-sm text-muted-foreground">
                将显示在收件人的邮箱中
              </p>
            </div>

            {/* 使用说明 */}
            <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
              <h4 className="font-medium text-sm">📖 使用说明</h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>访问 <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">resend.com</a> 注册账号（免费额度：每月 3,000 封邮件）</li>
                <li>在控制台创建 API Key 并复制到上方输入框</li>
                <li>添加并验证您的域名（或使用 Resend 提供的测试域名 onboarding@resend.dev）</li>
                <li>填写发件人邮箱和名称，点击保存</li>
                <li>使用"测试邮件发送"功能验证配置是否正确</li>
              </ol>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            <X className="h-4 w-4 mr-2" />
            取消
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                保存配置
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
