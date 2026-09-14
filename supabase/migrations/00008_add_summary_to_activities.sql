-- 为activities表添加summary字段
ALTER TABLE activities ADD COLUMN summary TEXT;

-- 添加注释
COMMENT ON COLUMN activities.summary IS '活动概要';