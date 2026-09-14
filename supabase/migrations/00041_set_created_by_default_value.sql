
-- 为 created_by 字段设置默认值为当前用户 ID
ALTER TABLE scheduled_tasks 
ALTER COLUMN created_by SET DEFAULT auth.uid();

-- 同时设置为 NOT NULL，确保每条记录都有创建者
ALTER TABLE scheduled_tasks 
ALTER COLUMN created_by SET NOT NULL;
