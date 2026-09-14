
-- 允许用户创建自己的定时任务（用于通知配置功能）
CREATE POLICY "用户可以创建自己的定时任务"
ON scheduled_tasks
FOR INSERT
TO public
WITH CHECK (created_by = auth.uid());

-- 允许用户查看自己的定时任务
CREATE POLICY "用户可以查看自己的定时任务"
ON scheduled_tasks
FOR SELECT
TO public
USING (created_by = auth.uid() OR EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
));

-- 允许用户更新自己的定时任务
CREATE POLICY "用户可以更新自己的定时任务"
ON scheduled_tasks
FOR UPDATE
TO public
USING (created_by = auth.uid() OR EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
));

-- 允许用户删除自己的定时任务
CREATE POLICY "用户可以删除自己的定时任务"
ON scheduled_tasks
FOR DELETE
TO public
USING (created_by = auth.uid() OR EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
));
