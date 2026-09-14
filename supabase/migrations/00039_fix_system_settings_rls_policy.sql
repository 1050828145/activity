-- 删除旧的RLS策略
DROP POLICY IF EXISTS "只有root用户可以修改系统配置" ON system_settings;

-- 创建函数检查是否是root用户
CREATE OR REPLACE FUNCTION is_root_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT COALESCE(
      (auth.jwt() -> 'user_metadata' ->> 'username') = 'root',
      false
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 新的RLS策略：只有root用户可以修改
CREATE POLICY "只有root用户可以修改系统配置"
  ON system_settings
  FOR ALL
  TO authenticated
  USING (is_root_user())
  WITH CHECK (is_root_user());

-- 添加注释
COMMENT ON FUNCTION is_root_user() IS '检查当前用户是否是root用户';