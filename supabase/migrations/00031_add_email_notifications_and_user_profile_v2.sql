-- 添加用户头像字段到profiles表
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 创建邮件通知任务表
CREATE TABLE IF NOT EXISTS email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekdays', 'custom')),
  schedule_time TEXT NOT NULL,
  schedule_days JSONB,
  content_types JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建邮件配置表（全局配置，仅root用户可修改）
CREATE TABLE IF NOT EXISTS email_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL,
  smtp_user TEXT NOT NULL,
  smtp_password TEXT NOT NULL,
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建用户头像存储桶
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-99gqsi7u251d_user_avatars', 'app-99gqsi7u251d_user_avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 设置用户头像存储桶策略（所有认证用户可上传）
CREATE POLICY "Users can upload their own avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'app-99gqsi7u251d_user_avatars');

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'app-99gqsi7u251d_user_avatars');

CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'app-99gqsi7u251d_user_avatars');

CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'app-99gqsi7u251d_user_avatars');

-- 邮件通知任务表的RLS策略
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email notifications"
ON email_notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own email notifications"
ON email_notifications FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own email notifications"
ON email_notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own email notifications"
ON email_notifications FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- 邮件配置表的RLS策略（仅root用户可访问）
ALTER TABLE email_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only root can view email config"
ON email_config FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.username = 'root'
  )
);

CREATE POLICY "Only root can insert email config"
ON email_config FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.username = 'root'
  )
);

CREATE POLICY "Only root can update email config"
ON email_config FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.username = 'root'
  )
);

CREATE POLICY "Only root can delete email config"
ON email_config FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.username = 'root'
  )
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_email_notifications_user_id ON email_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_enabled ON email_notifications(enabled);