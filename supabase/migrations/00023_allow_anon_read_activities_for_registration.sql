-- 允许匿名用户读取活动信息（用于报名页面）
-- 但不允许匿名用户进行增删改操作
DROP POLICY IF EXISTS "activities_read_anon_policy" ON public.activities;

CREATE POLICY "activities_read_anon_policy" ON public.activities
FOR SELECT TO anon
USING (true);

-- 确认其他表的匿名访问已被禁止
-- persons, leaders, activity_leaders 不允许匿名 SELECT
-- 这些策略已经在之前的迁移中设置，这里只是注释确认

-- 注意：activity_participants 允许匿名 INSERT（报名），但不允许匿名 SELECT
-- 这样匿名用户可以提交报名，但看不到其他人的报名信息
