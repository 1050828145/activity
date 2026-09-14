-- 创建调度器锁表（用于分布式锁）
CREATE TABLE IF NOT EXISTS scheduler_locks (
  id TEXT PRIMARY KEY DEFAULT 'scheduler',
  locked_by TEXT NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- 插入默认锁记录
INSERT INTO scheduler_locks (id, locked_by, locked_at, expires_at)
VALUES ('scheduler', 'none', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 创建获取锁的函数
CREATE OR REPLACE FUNCTION acquire_scheduler_lock(
  p_instance_id TEXT,
  p_lock_duration_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN AS $$
DECLARE
  v_acquired BOOLEAN;
BEGIN
  -- 尝试获取锁（如果锁已过期或未被持有）
  UPDATE scheduler_locks
  SET 
    locked_by = p_instance_id,
    locked_at = NOW(),
    expires_at = NOW() + (p_lock_duration_seconds || ' seconds')::INTERVAL
  WHERE id = 'scheduler'
    AND (expires_at < NOW() OR locked_by = p_instance_id OR locked_by = 'none');
  
  -- 检查是否成功获取锁
  SELECT locked_by = p_instance_id INTO v_acquired
  FROM scheduler_locks
  WHERE id = 'scheduler';
  
  RETURN COALESCE(v_acquired, FALSE);
END;
$$ LANGUAGE plpgsql;

-- 创建释放锁的函数
CREATE OR REPLACE FUNCTION release_scheduler_lock(p_instance_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE scheduler_locks
  SET 
    locked_by = 'none',
    expires_at = NOW()
  WHERE id = 'scheduler'
    AND locked_by = p_instance_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 创建获取待执行任务的函数
CREATE OR REPLACE FUNCTION get_pending_tasks()
RETURNS TABLE (
  id UUID,
  name TEXT,
  task_type TEXT,
  cron_expression TEXT,
  task_config JSONB,
  last_execution_time TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.task_type,
    t.cron_expression,
    t.task_config,
    t.last_execution_time
  FROM scheduled_tasks t
  WHERE t.enabled = TRUE
  ORDER BY t.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建更新任务执行时间的函数
CREATE OR REPLACE FUNCTION update_task_execution_time(
  p_task_id UUID,
  p_execution_time TIMESTAMPTZ
)
RETURNS VOID AS $$
BEGIN
  UPDATE scheduled_tasks
  SET 
    last_execution_time = p_execution_time,
    updated_at = NOW()
  WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 添加注释
COMMENT ON TABLE scheduler_locks IS '调度器分布式锁表';
COMMENT ON FUNCTION acquire_scheduler_lock IS '获取调度器锁';
COMMENT ON FUNCTION release_scheduler_lock IS '释放调度器锁';
COMMENT ON FUNCTION get_pending_tasks IS '获取所有启用的任务';
COMMENT ON FUNCTION update_task_execution_time IS '更新任务最后执行时间';