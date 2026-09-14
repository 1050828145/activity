-- 1. 为所有核心表启用 RLS (Row Level Security)
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_leaders ENABLE ROW LEVEL SECURITY;

-- 2. 删除所有 public 角色的策略 (objects 表除外)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE roles::text LIKE '%public%' 
        AND schemaname = 'public'
        AND tablename != 'objects'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- 3. 定义管理员 (role='admin') 辅助函数
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 重新建立数据隔离策略

-- activities (有 user_id)
CREATE POLICY "activities_auth_policy" ON public.activities
FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.is_admin())
WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "activities_read_anon_policy" ON public.activities
FOR SELECT TO anon
USING (false); -- 匿名用户彻底无法查询任何活动列表

-- persons (有 user_id)
CREATE POLICY "persons_auth_policy" ON public.persons
FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.is_admin())
WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- leaders (有 user_id)
CREATE POLICY "leaders_auth_policy" ON public.leaders
FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.is_admin())
WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- activity_participants (无 user_id，通过关联的 activity_id 校验权限)
-- 允许匿名用户插入报名记录 (必须公开)
CREATE POLICY "participants_anon_insert_policy" ON public.activity_participants
FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- 仅允许 authenticated 用户查看自己创建的活动中的参与者
CREATE POLICY "participants_auth_read_policy" ON public.activity_participants
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.activities a 
    WHERE a.id = activity_id AND (a.user_id = auth.uid() OR public.is_admin())
  )
);

-- 管理权限
CREATE POLICY "participants_auth_all_policy" ON public.activity_participants
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.activities a 
    WHERE a.id = activity_id AND (a.user_id = auth.uid() OR public.is_admin())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.activities a 
    WHERE a.id = activity_id AND (a.user_id = auth.uid() OR public.is_admin())
  )
);

-- activity_leaders (无 user_id，通过关联的 activity_id 校验权限)
CREATE POLICY "activity_leaders_auth_all_policy" ON public.activity_leaders
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.activities a 
    WHERE a.id = activity_id AND (a.user_id = auth.uid() OR public.is_admin())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.activities a 
    WHERE a.id = activity_id AND (a.user_id = auth.uid() OR public.is_admin())
  )
);

-- 5. 确保针对这些核心表的 SELECT 操作对 anon 角色完全关闭（除了 INSERT）
-- 注意：RLS 默认就会拦截，但显式定义 USING(false) 更加安全。
-- 这里的逻辑已经是：只有为特定的 CMD 赋予策略，才会有权限。
-- 由于对 anon 角色我们只赋予了 INSERT 的 policy，那么 SELECT/UPDATE/DELETE 默认全拦截。
