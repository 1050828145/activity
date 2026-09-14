-- 添加"线上"活动类型
INSERT INTO activity_types (name, description) VALUES
  ('线上', '线上活动，不需要指定具体日期，参与人数由领队统计')
ON CONFLICT (name) DO NOTHING;

-- 创建领队参与人数表
CREATE TABLE IF NOT EXISTS leader_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  leader_id UUID NOT NULL REFERENCES leaders(id) ON DELETE CASCADE,
  participant_count INTEGER NOT NULL DEFAULT 0 CHECK (participant_count >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  
  -- 确保同一个活动中每个领队只有一条记录
  UNIQUE(activity_id, leader_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_leader_participants_activity_id ON leader_participants(activity_id);
CREATE INDEX IF NOT EXISTS idx_leader_participants_leader_id ON leader_participants(leader_id);
CREATE INDEX IF NOT EXISTS idx_leader_participants_created_by ON leader_participants(created_by);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_leader_participants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_leader_participants_updated_at
  BEFORE UPDATE ON leader_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_leader_participants_updated_at();

-- 启用 RLS
ALTER TABLE leader_participants ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能访问自己创建的数据
CREATE POLICY "Users can view their own leader participants"
  ON leader_participants FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Users can insert their own leader participants"
  ON leader_participants FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own leader participants"
  ON leader_participants FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own leader participants"
  ON leader_participants FOR DELETE
  USING (created_by = auth.uid());

-- 创建函数：获取活动的总参与人数
-- 根据活动类型返回不同的计算结果
CREATE OR REPLACE FUNCTION get_activity_participant_count(activity_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  activity_type_name TEXT;
  participant_count INTEGER;
BEGIN
  -- 获取活动类型名称
  SELECT at.name INTO activity_type_name
  FROM activities a
  LEFT JOIN activity_types at ON a.activity_type_id = at.id
  WHERE a.id = activity_uuid;
  
  -- 如果是线上活动，返回领队拉人数总和
  IF activity_type_name = '线上' THEN
    SELECT COALESCE(SUM(lp.participant_count), 0) INTO participant_count
    FROM leader_participants lp
    WHERE lp.activity_id = activity_uuid;
  ELSE
    -- 其他类型活动，返回实际参与人员记录数
    SELECT COUNT(*) INTO participant_count
    FROM participations p
    WHERE p.activity_id = activity_uuid;
  END IF;
  
  RETURN participant_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建视图：带参与人数的活动列表
CREATE OR REPLACE VIEW activities_with_participant_count AS
SELECT 
  a.*,
  get_activity_participant_count(a.id) as participant_count
FROM activities a;

-- 授予视图访问权限
GRANT SELECT ON activities_with_participant_count TO authenticated;
