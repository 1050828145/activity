-- 创建一个表来记录邮件发送日志
CREATE TABLE IF NOT EXISTS email_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES email_notifications(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_email_send_logs_notification_id ON email_send_logs(notification_id);
CREATE INDEX IF NOT EXISTS idx_email_send_logs_sent_at ON email_send_logs(sent_at);

-- 添加 RLS 策略
ALTER TABLE email_send_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可以查看自己的邮件发送日志"
  ON email_send_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM email_notifications
      WHERE email_notifications.id = email_send_logs.notification_id
      AND email_notifications.user_id = auth.uid()
    )
  );

-- root 用户可以查看所有日志
CREATE POLICY "root用户可以查看所有邮件发送日志"
  ON email_send_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.username = 'root'
    )
  );

-- 添加注释
COMMENT ON TABLE email_send_logs IS '邮件发送日志表';
COMMENT ON COLUMN email_send_logs.notification_id IS '关联的通知任务ID';
COMMENT ON COLUMN email_send_logs.user_email IS '收件人邮箱';
COMMENT ON COLUMN email_send_logs.status IS '发送状态：success=成功, failed=失败';
COMMENT ON COLUMN email_send_logs.error_message IS '错误信息（如果失败）';
COMMENT ON COLUMN email_send_logs.sent_at IS '发送时间';