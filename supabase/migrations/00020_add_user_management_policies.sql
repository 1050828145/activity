
-- 确保 is_admin 函数存在
CREATE OR REPLACE FUNCTION is_admin(uid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = uid AND p.role = 'admin'
  );
$$;

-- 允许管理员查看所有备份日志（之前只允许查看自己的）
DROP POLICY IF EXISTS "Users can view their own backup logs" ON backup_logs;
CREATE POLICY "Admins can view all backup logs" ON backup_logs
    FOR SELECT TO authenticated USING (is_admin(auth.uid()) OR auth.uid() = user_id);

-- 允许管理员查看所有 profile
-- 之前的策略是：Users can view their own profile
DROP POLICY IF EXISTS "Admins have full access to profiles" ON profiles;
CREATE POLICY "Admins have full access to profiles" ON profiles
  FOR ALL TO authenticated USING (is_admin(auth.uid()));

-- 确保普通用户仍然可以查看和更新自己的 profile
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id)
  WITH CHECK (role IS NOT DISTINCT FROM (SELECT role FROM profiles WHERE id = auth.uid()));
