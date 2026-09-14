import { useState, useEffect } from 'react';
import { User, Mail, Upload, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { getUserProfile, updateUserProfile, uploadAvatar } from '@/db/api';
import { compressImage, isImageFile, formatFileSize } from '@/utils/imageCompression';
import type { UserProfile } from '@/types';

export default function UserCenter() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await getUserProfile();
      setProfile(data);
      setUsername(data?.username || '');
      setEmail(data?.email || '');
    } catch (error) {
      console.error('加载用户资料失败:', error);
      toast.error('加载用户资料失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!username.trim()) {
      toast.error('用户名不能为空');
      return;
    }

    try {
      setSaving(true);
      await updateUserProfile({
        username: username.trim(),
        email: email.trim() || undefined,
      });
      toast.success('保存成功');
      loadProfile();
    } catch (error) {
      console.error('保存用户资料失败:', error);
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!isImageFile(file)) {
      toast.error('请上传图片文件（JPEG、PNG、GIF、WEBP、AVIF）');
      return;
    }

    // 验证文件大小
    const maxSize = 1 * 1024 * 1024; // 1MB
    let fileToUpload = file;

    if (file.size > maxSize) {
      try {
        toast.info('图片过大，正在自动压缩...');
        fileToUpload = await compressImage(file, 1, 1080, 1080);
        toast.success(`压缩完成，文件大小：${formatFileSize(fileToUpload.size)}`);
      } catch (error) {
        console.error('图片压缩失败:', error);
        toast.error('图片压缩失败');
        return;
      }
    }

    try {
      setUploading(true);
      const avatarUrl = await uploadAvatar(fileToUpload);
      await updateUserProfile({ avatar_url: avatarUrl });
      toast.success('头像上传成功');
      loadProfile();
    } catch (error) {
      console.error('头像上传失败:', error);
      toast.error('头像上传失败');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">用户中心</h1>
        <p className="text-muted-foreground mt-2">管理您的个人信息和偏好设置</p>
      </div>

      <div className="grid gap-6">
        {/* 头像设置 */}
        <Card>
          <CardHeader>
            <CardTitle>头像设置</CardTitle>
            <CardDescription>上传您的个人头像</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile?.avatar_url} alt={profile?.username} />
                <AvatarFallback className="text-2xl">
                  {profile?.username?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <input
                  type="file"
                  id="avatar-upload"
                  accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('avatar-upload')?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      上传中...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      上传头像
                    </>
                  )}
                </Button>
                <p className="text-sm text-muted-foreground mt-2">
                  支持 JPEG、PNG、GIF、WEBP、AVIF 格式，最大 1MB
                </p>
                <p className="text-sm text-muted-foreground">
                  超过 1MB 将自动压缩为 WEBP 格式
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 基本信息 */}
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
            <CardDescription>修改您的用户名和邮箱</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名 *</Label>
              <div className="flex gap-2">
                <User className="h-5 w-5 text-muted-foreground mt-2" />
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入用户名"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <div className="flex gap-2">
                <Mail className="h-5 w-5 text-muted-foreground mt-2" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="请输入邮箱地址"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                用于接收邮件通知
              </p>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  '保存修改'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 账户信息 */}
        <Card>
          <CardHeader>
            <CardTitle>账户信息</CardTitle>
            <CardDescription>您的账户详细信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">角色</span>
              <span className="font-medium">{profile?.role === 'root' ? '管理员' : '普通用户'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">注册时间</span>
              <span className="font-medium">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('zh-CN') : '-'}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">最后更新</span>
              <span className="font-medium">
                {profile?.updated_at ? new Date(profile.updated_at).toLocaleDateString('zh-CN') : '-'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
