-- 1. 为 activity_leaders 表增加参与人数字段
ALTER TABLE activity_leaders 
ADD COLUMN participant_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN activity_leaders.participant_count IS '该领队带的参与人数';