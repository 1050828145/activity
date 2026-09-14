// 图片压缩工具函数

/**
 * 压缩图片到指定大小以下
 * @param file 原始文件
 * @param maxSizeMB 最大文件大小（MB）
 * @param maxWidth 最大宽度
 * @param maxHeight 最大高度
 * @returns 压缩后的文件
 */
export async function compressImage(
  file: File,
  maxSizeMB: number = 1,
  maxWidth: number = 1920,
  maxHeight: number = 1080
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // 计算缩放比例
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法获取canvas上下文'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // 尝试不同的质量级别进行压缩
        let quality = 0.8;
        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('图片压缩失败'));
                return;
              }

              const maxSize = maxSizeMB * 1024 * 1024;
              if (blob.size <= maxSize || quality <= 0.1) {
                // 创建新文件
                const compressedFile = new File(
                  [blob],
                  file.name.replace(/\.[^.]+$/, '.webp'),
                  { type: 'image/webp' }
                );
                resolve(compressedFile);
              } else {
                // 降低质量继续压缩
                quality -= 0.1;
                tryCompress();
              }
            },
            'image/webp',
            quality
          );
        };

        tryCompress();
      };
      img.onerror = () => {
        reject(new Error('图片加载失败'));
      };
    };
    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };
  });
}

/**
 * 验证文件是否为图片
 * @param file 文件
 * @returns 是否为图片
 */
export function isImageFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
  return validTypes.includes(file.type);
}

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化后的大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
