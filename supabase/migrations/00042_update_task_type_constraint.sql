
-- 删除旧的约束
ALTER TABLE scheduled_tasks 
DROP CONSTRAINT IF EXISTS scheduled_tasks_task_type_check;

-- 添加新的约束，包含通知类型
ALTER TABLE scheduled_tasks 
ADD CONSTRAINT scheduled_tasks_task_type_check 
CHECK (task_type IN (
  'send_email',
  'data_cleanup', 
  'report_generation',
  'custom',
  'email_notification',
  'sms_notification',
  'wechat_notification'
));
