import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { uploadPersonPhoto, deletePersonPhoto } from '@/db/api';
import { toast } from 'sonner';

interface PersonImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
}

// 图片压缩函数
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // 限制最大分辨率为1080p
        const maxWidth = 1920;
        const maxHeight = 1080;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // 转换为WEBP格式并压缩
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), {
                type: 'image/webp',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('压缩失败'));
            }
          },
          'image/webp',
          0.8
        );
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

export default function PersonImageUpload({ value, onChange }: PersonImageUploadProps) {
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];

      // 验证文件名只包含英文和数字
      const fileName = file.name.replace(/\.[^.]+$/, '');
      if (!/^[a-zA-Z0-9_-]+$/.test(fileName)) {
        toast.error('文件名只能包含英文字母和数字');
        return;
      }

      try {
        setUploading(true);

        let uploadFile = file;

        // 如果文件大于1MB,进行压缩
        if (file.size > 1048576) {
          toast.info('图片较大,正在自动压缩...');
          uploadFile = await compressImage(file);
          const compressedSizeKB = (uploadFile.size / 1024).toFixed(2);
          toast.success(`图片已压缩至 ${compressedSizeKB} KB`);
        }

        // 上传图片
        const url = await uploadPersonPhoto(uploadFile);
        onChange(url);
        toast.success('图片上传成功');
      } catch (error) {
        console.error('上传图片失败:', error);
        toast.error('上传图片失败');
      } finally {
        setUploading(false);
      }
    },
    [onChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
      'image/avif': ['.avif'],
    },
    maxFiles: 1,
    disabled: uploading,
  });

  const handleRemove = async () => {
    if (value) {
      try {
        await deletePersonPhoto(value);
        onChange('');
        toast.success('图片删除成功');
      } catch (error) {
        console.error('删除图片失败:', error);
        toast.error('删除图片失败');
      }
    }
  };

  return (
    <div className="space-y-4">
      {value ? (
        <div className="relative inline-block">
          <img
            src={value}
            alt="人员照片"
            className="w-32 h-32 object-cover rounded-lg border border-border"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6"
            onClick={handleRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
            isDragActive
              ? 'border-primary bg-accent'
              : 'border-border hover:border-primary hover:bg-accent',
            uploading && 'opacity-50 cursor-not-allowed'
          )}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
              <p className="text-sm text-muted-foreground">上传中...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {isDragActive ? '释放以上传图片' : '点击或拖拽图片到此处上传'}
              </p>
              <p className="text-xs text-muted-foreground">
                支持 JPG、PNG、GIF、WEBP、AVIF 格式,最大 1MB
              </p>
              <p className="text-xs text-muted-foreground">
                超过 1MB 将自动压缩
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
