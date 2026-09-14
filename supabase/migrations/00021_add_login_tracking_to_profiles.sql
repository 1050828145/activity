-- 增加登录追踪字段
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_login_ip TEXT;

-- 注释
COMMENT ON COLUMN public.profiles.last_login_at IS '最近登录时间';
COMMENT ON COLUMN public.profiles.last_login_ip IS '最近登录IP地址';
