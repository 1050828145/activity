-- 为 activity_participants 表添加 added_at 字段
ALTER TABLE activity_participants 
ADD COLUMN added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 将现有记录的 added_at 设置为 created_at 的值
UPDATE activity_participants 
SET added_at = created_at 
WHERE added_at IS NULL;

-- 添加注释
COMMENT ON COLUMN activity_participants.added_at IS '参与人员添加时间（精确到分钟）';
