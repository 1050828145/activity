-- 1. 为 activities 表增加总参与人数缓存字段
ALTER TABLE activities 
ADD COLUMN total_participants integer NOT NULL DEFAULT 0;

-- 2. 初始化现有活动的总参与人数
UPDATE activities 
SET total_participants = COALESCE((
  SELECT SUM(participant_count) 
  FROM activity_leaders 
  WHERE activity_leaders.activity_id = activities.id
), 0);

-- 3. 创建活动领队人数变更记录表
CREATE TABLE activity_leader_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_leader_id uuid NOT NULL REFERENCES activity_leaders(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  leader_id uuid NOT NULL REFERENCES leaders(id) ON DELETE CASCADE,
  change_amount integer NOT NULL, -- 变更数量（正数=增加，负数=减少）
  previous_count integer NOT NULL, -- 变更前的人数
  new_count integer NOT NULL, -- 变更后的人数
  changed_by uuid NOT NULL REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  note text, -- 备注
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. 创建索引
CREATE INDEX idx_activity_leader_changes_activity_leader ON activity_leader_changes(activity_leader_id);
CREATE INDEX idx_activity_leader_changes_activity ON activity_leader_changes(activity_id);
CREATE INDEX idx_activity_leader_changes_leader ON activity_leader_changes(leader_id);
CREATE INDEX idx_activity_leader_changes_changed_at ON activity_leader_changes(changed_at DESC);

-- 5. 启用 RLS
ALTER TABLE activity_leader_changes ENABLE ROW LEVEL SECURITY;

-- 6. 创建 RLS 策略
CREATE POLICY "用户可以查看自己创建的活动的变更记录"
  ON activity_leader_changes FOR SELECT
  USING (
    activity_id IN (
      SELECT id FROM activities WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "用户可以创建自己活动的变更记录"
  ON activity_leader_changes FOR INSERT
  WITH CHECK (
    activity_id IN (
      SELECT id FROM activities WHERE user_id = auth.uid()
    )
  );

-- 7. 创建函数：更新领队人数（增量方式）
CREATE OR REPLACE FUNCTION update_activity_leader_count(
  p_activity_leader_id uuid,
  p_change_amount integer,
  p_note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_activity_leader activity_leaders%ROWTYPE;
  v_previous_count integer;
  v_new_count integer;
  v_activity_id uuid;
  v_leader_id uuid;
  v_user_id uuid;
  v_change_id uuid;
BEGIN
  -- 获取当前用户
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '未登录';
  END IF;

  -- 获取领队信息
  SELECT * INTO v_activity_leader
  FROM activity_leaders
  WHERE id = p_activity_leader_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '领队记录不存在';
  END IF;

  -- 检查权限
  IF NOT EXISTS (
    SELECT 1 FROM activities 
    WHERE id = v_activity_leader.activity_id 
    AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION '无权限修改此活动';
  END IF;

  -- 计算新人数
  v_previous_count := v_activity_leader.participant_count;
  v_new_count := v_previous_count + p_change_amount;

  -- 检查新人数不能为负数
  IF v_new_count < 0 THEN
    RAISE EXCEPTION '人数不能为负数';
  END IF;

  v_activity_id := v_activity_leader.activity_id;
  v_leader_id := v_activity_leader.leader_id;

  -- 更新领队人数
  UPDATE activity_leaders
  SET 
    participant_count = v_new_count,
    updated_at = now()
  WHERE id = p_activity_leader_id;

  -- 记录变更
  INSERT INTO activity_leader_changes (
    activity_leader_id,
    activity_id,
    leader_id,
    change_amount,
    previous_count,
    new_count,
    changed_by,
    note
  ) VALUES (
    p_activity_leader_id,
    v_activity_id,
    v_leader_id,
    p_change_amount,
    v_previous_count,
    v_new_count,
    v_user_id,
    p_note
  ) RETURNING id INTO v_change_id;

  -- 更新活动总人数
  UPDATE activities
  SET 
    total_participants = (
      SELECT COALESCE(SUM(participant_count), 0)
      FROM activity_leaders
      WHERE activity_id = v_activity_id
    ),
    updated_at = now()
  WHERE id = v_activity_id;

  RETURN json_build_object(
    'success', true,
    'change_id', v_change_id,
    'previous_count', v_previous_count,
    'new_count', v_new_count,
    'change_amount', p_change_amount
  );
END;
$$;

-- 8. 创建触发器：自动更新活动总人数（备用方案）
CREATE OR REPLACE FUNCTION update_activity_total_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- 更新活动总人数
  UPDATE activities
  SET 
    total_participants = (
      SELECT COALESCE(SUM(participant_count), 0)
      FROM activity_leaders
      WHERE activity_id = COALESCE(NEW.activity_id, OLD.activity_id)
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.activity_id, OLD.activity_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_update_activity_total_participants_on_leader_change
AFTER INSERT OR UPDATE OR DELETE ON activity_leaders
FOR EACH ROW
EXECUTE FUNCTION update_activity_total_participants();

COMMENT ON TABLE activity_leader_changes IS '活动领队人数变更记录表';
COMMENT ON COLUMN activity_leader_changes.change_amount IS '变更数量（正数=增加，负数=减少）';
COMMENT ON COLUMN activity_leader_changes.previous_count IS '变更前的人数';
COMMENT ON COLUMN activity_leader_changes.new_count IS '变更后的人数';
COMMENT ON COLUMN activities.total_participants IS '活动总参与人数（缓存字段）';