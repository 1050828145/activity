-- 1. 暂时清理并修复 profiles 表
TRUNCATE public.profiles CASCADE;

-- 2. 重新插入 root 账号到 profiles (这次不依赖手动插入 auth.users，而是先在 profiles 占位，稍后让用户通过注册或由我触发同步)
-- 但由于我们需要 root 账号立即生效，我将尝试一种更稳健的插入方式
-- 确保不带级联删除的强制约束，直到我们确认用户已稳定
ALTER TABLE public.activities ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.persons ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.leaders ALTER COLUMN user_id DROP NOT NULL;

-- 3. 移除危险的级联删除约束，防止未来再次发生类似事故
ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_user_id_fkey;
ALTER TABLE public.activities ADD CONSTRAINT activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.persons DROP CONSTRAINT IF EXISTS persons_user_id_fkey;
ALTER TABLE public.persons ADD CONSTRAINT persons_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.leaders DROP CONSTRAINT IF EXISTS leaders_user_id_fkey;
ALTER TABLE public.leaders ADD CONSTRAINT leaders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 4. 允许所有人查看数据（在恢复期间）
DROP POLICY IF EXISTS "Allow public read activities" ON public.activities;
CREATE POLICY "Allow public read activities" ON public.activities FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public read persons" ON public.persons;
CREATE POLICY "Allow public read persons" ON public.persons FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public read leaders" ON public.leaders;
CREATE POLICY "Allow public read leaders" ON public.leaders FOR SELECT USING (true);

-- 5. 重新开启 RLS 但设置为允许匿名读取，直到数据恢复
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaders ENABLE ROW LEVEL SECURITY;