-- 删除旧的 email_config 表
DROP TABLE IF EXISTS email_config;

-- 创建新的 email_config 表（适配 Resend）
CREATE TABLE email_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_api_key text NOT NULL,
  from_email text NOT NULL,
  from_name text NOT NULL DEFAULT '活动与人员管理系统',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 只允许 root 用户访问
ALTER TABLE email_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "只有root用户可以访问邮箱配置"
  ON email_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.username = 'root'
    )
  );

-- 添加注释
COMMENT ON TABLE email_config IS 'Resend 邮箱配置表（仅 root 用户可访问）';
COMMENT ON COLUMN email_config.resend_api_key IS 'Resend API 密钥';
COMMENT ON COLUMN email_config.from_email IS '发件人邮箱（需在 Resend 后台验证）';
COMMENT ON COLUMN email_config.from_name IS '发件人名称';