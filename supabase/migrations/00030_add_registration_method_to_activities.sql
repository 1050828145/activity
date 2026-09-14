-- 为 activities 表添加报名方式字段
ALTER TABLE activities ADD COLUMN IF NOT EXISTS registration_method TEXT;

-- 添加注释
COMMENT ON COLUMN activities.registration_method IS '报名方式（如：微信报名、电话报名、现场报名等）';
