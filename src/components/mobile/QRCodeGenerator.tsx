import { useState } from 'react';
import { QrCode, Download, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import QRCode from 'qrcode';
import { toast } from 'sonner';

interface QRCodeGeneratorProps {
  activityId: string;
  activityName: string;
}

export default function QRCodeGenerator({ activityId, activityName }: QRCodeGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [generating, setGenerating] = useState(false);

  const generateQRCode = async () => {
    try {
      setGenerating(true);
      setOpen(true);
      
      // 生成报名页面URL
      const registerUrl = `${window.location.origin}/mobile/activity/${activityId}/register`;
      
      // 生成二维码
      const qrDataUrl = await QRCode.toDataURL(registerUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      
      setQrCodeUrl(qrDataUrl);
      toast.success('二维码生成成功');
    } catch (error) {
      console.error('生成二维码失败:', error);
      toast.error('生成二维码失败');
      setOpen(false);
    } finally {
      setGenerating(false);
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeUrl) return;

    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `${activityName}-报名二维码.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('二维码已下载');
  };

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={generateQRCode}
        disabled={generating}
      >
        <QrCode className="h-5 w-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>活动报名二维码</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center items-center min-h-[300px]">
              {generating ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">正在生成二维码...</p>
                </div>
              ) : qrCodeUrl ? (
                <img
                  src={qrCodeUrl}
                  alt="报名二维码"
                  className="w-full max-w-[300px] h-auto"
                />
              ) : null}
            </div>
            {!generating && qrCodeUrl && (
              <>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground text-center">
                    扫描二维码即可报名参加活动
                  </p>
                  <p className="text-xs text-muted-foreground text-center">
                    {activityName}
                  </p>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-primary">
                    <CheckCircle className="h-3 w-3" />
                    <span>应用运行期间永久有效</span>
                  </div>
                </div>
                <Button onClick={downloadQRCode} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  下载二维码
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
