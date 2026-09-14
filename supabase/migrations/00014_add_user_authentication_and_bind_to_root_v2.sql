-- 创建用户角色枚举
CREATE TYPE public.user_role AS ENUM ('user', 'admin');

-- 创建 profiles 表
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  email text,
  role public.user_role NOT NULL DEFAULT 'user'::public.user_role,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 启用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 创建 is_admin 辅助函数
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = uid AND p.role = 'admin'::public.user_role
  );
$$;

-- Profiles 表的 RLS 策略
CREATE POLICY "管理员可以访问所有用户资料" ON public.profiles
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "用户可以查看自己的资料" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "用户可以更新自己的资料" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id)
  WITH CHECK (role IS NOT DISTINCT FROM (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- 创建公开视图
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT id, username, role FROM public.profiles;

-- 创建新用户同步触发器函数
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count int;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  
  -- 插入用户资料，第一个用户为管理员
  INSERT INTO public.profiles (id, username, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email,
    CASE WHEN user_count = 0 THEN 'admin'::public.user_role ELSE 'user'::public.user_role END
  );
  
  RETURN NEW;
END;
$$;

-- 创建触发器
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_user();

-- 为现有表添加 user_id 字段
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.persons ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.leaders ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 创建 root 用户
DO $$
DECLARE
  root_user_id uuid;
BEGIN
  -- 生成固定的 UUID 作为 root 用户 ID
  root_user_id := 'a0000000-0000-0000-0000-000000000001'::uuid;
  
  -- 插入 auth.users 记录（如果不存在）
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at,
    aud,
    role
  )
  SELECT
    root_user_id,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'root@miaoda.com',
    crypt('root', gen_salt('bf')),
    now(),
    jsonb_build_object('username', 'root'),
    now(),
    now(),
    'authenticated',
    'authenticated'
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = root_user_id
  );
  
  -- 插入 profiles 记录（如果不存在）
  INSERT INTO public.profiles (id, username, email, role, created_at, updated_at)
  SELECT
    root_user_id,
    'root',
    'root@miaoda.com',
    'admin'::public.user_role,
    now(),
    now()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = root_user_id
  );
  
  -- 将所有现有数据绑定到 root 用户
  UPDATE public.activities SET user_id = root_user_id WHERE user_id IS NULL;
  UPDATE public.persons SET user_id = root_user_id WHERE user_id IS NULL;
  UPDATE public.leaders SET user_id = root_user_id WHERE user_id IS NULL;
END $$;

-- 设置 user_id 为非空
ALTER TABLE public.activities ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.persons ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.leaders ALTER COLUMN user_id SET NOT NULL;

-- 为 activities 表添加 RLS 策略
DROP POLICY IF EXISTS "用户可以查看自己的活动" ON public.activities;
CREATE POLICY "用户可以查看自己的活动" ON public.activities
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "用户可以创建活动" ON public.activities;
CREATE POLICY "用户可以创建活动" ON public.activities
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "用户可以更新自己的活动" ON public.activities;
CREATE POLICY "用户可以更新自己的活动" ON public.activities
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "用户可以删除自己的活动" ON public.activities;
CREATE POLICY "用户可以删除自己的活动" ON public.activities
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 为 persons 表添加 RLS 策略
DROP POLICY IF EXISTS "用户可以查看自己的人员" ON public.persons;
CREATE POLICY "用户可以查看自己的人员" ON public.persons
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "用户可以创建人员" ON public.persons;
CREATE POLICY "用户可以创建人员" ON public.persons
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "用户可以更新自己的人员" ON public.persons;
CREATE POLICY "用户可以更新自己的人员" ON public.persons
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "用户可以删除自己的人员" ON public.persons;
CREATE POLICY "用户可以删除自己的人员" ON public.persons
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 为 leaders 表添加 RLS 策略
DROP POLICY IF EXISTS "用户可以查看自己的领队" ON public.leaders;
CREATE POLICY "用户可以查看自己的领队" ON public.leaders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "用户可以创建领队" ON public.leaders;
CREATE POLICY "用户可以创建领队" ON public.leaders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "用户可以更新自己的领队" ON public.leaders;
CREATE POLICY "用户可以更新自己的领队" ON public.leaders
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "用户可以删除自己的领队" ON public.leaders;
CREATE POLICY "用户可以删除自己的领队" ON public.leaders
  FOR DELETE TO authenticated USING (auth.uid() = user_id);