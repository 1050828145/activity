-- 创建系统配置表
CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);

-- 启用 RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- RLS 策略：所有用户可以查看
CREATE POLICY "所有用户可以查看系统配置"
  ON system_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS 策略：只有 root 用户可以修改
CREATE POLICY "只有root用户可以修改系统配置"
  ON system_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'username' = 'root'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'username' = 'root'
    )
  );

-- 插入默认配置：调度器启用状态
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES 
  ('scheduler_enabled', 'true', '定时任务调度器是否启用'),
  ('scheduler_last_updated', NOW()::text, '调度器状态最后更新时间')
ON CONFLICT (setting_key) DO NOTHING;

-- 添加注释
COMMENT ON TABLE system_settings IS '系统配置表';
COMMENT ON COLUMN system_settings.setting_key IS '配置键名';
COMMENT ON COLUMN system_settings.setting_value IS '配置值';
COMMENT ON COLUMN system_settings.description IS '配置描述';