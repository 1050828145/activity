-- 创建定时任务表
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL CHECK (task_type IN ('send_email', 'data_cleanup', 'report_generation', 'custom')),
  cron_expression TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  task_config JSONB,
  last_execution_time TIMESTAMPTZ,
  next_execution_time TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建任务执行日志表
CREATE TABLE IF NOT EXISTS task_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'running')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  execution_details JSONB
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_enabled ON scheduled_tasks(enabled);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_next_execution ON scheduled_tasks(next_execution_time);
CREATE INDEX IF NOT EXISTS idx_task_execution_logs_task_id ON task_execution_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_execution_logs_started_at ON task_execution_logs(started_at DESC);

-- 启用 RLS
ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_execution_logs ENABLE ROW LEVEL SECURITY;

-- RLS 策略：只有管理员可以管理定时任务
CREATE POLICY "管理员可以查看所有定时任务"
  ON scheduled_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "管理员可以创建定时任务"
  ON scheduled_tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "管理员可以更新定时任务"
  ON scheduled_tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "管理员可以删除定时任务"
  ON scheduled_tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 任务执行日志的 RLS 策略
CREATE POLICY "管理员可以查看所有任务执行日志"
  ON task_execution_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 添加注释
COMMENT ON TABLE scheduled_tasks IS '定时任务配置表';
COMMENT ON COLUMN scheduled_tasks.name IS '任务名称';
COMMENT ON COLUMN scheduled_tasks.description IS '任务描述';
COMMENT ON COLUMN scheduled_tasks.task_type IS '任务类型：send_email=发送邮件, data_cleanup=数据清理, report_generation=报表生成, custom=自定义';
COMMENT ON COLUMN scheduled_tasks.cron_expression IS 'Cron 表达式';
COMMENT ON COLUMN scheduled_tasks.enabled IS '是否启用';
COMMENT ON COLUMN scheduled_tasks.task_config IS '任务配置（JSON格式）';
COMMENT ON COLUMN scheduled_tasks.last_execution_time IS '最后执行时间';
COMMENT ON COLUMN scheduled_tasks.next_execution_time IS '下次执行时间';

COMMENT ON TABLE task_execution_logs IS '任务执行日志表';
COMMENT ON COLUMN task_execution_logs.task_id IS '关联的任务ID';
COMMENT ON COLUMN task_execution_logs.status IS '执行状态：success=成功, failed=失败, running=运行中';
COMMENT ON COLUMN task_execution_logs.started_at IS '开始时间';
COMMENT ON COLUMN task_execution_logs.completed_at IS '完成时间';
COMMENT ON COLUMN task_execution_logs.error_message IS '错误信息';
COMMENT ON COLUMN task_execution_logs.execution_details IS '执行详情（JSON格式）';