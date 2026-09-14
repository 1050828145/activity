-- 创建领队表
CREATE TABLE IF NOT EXISTS leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  gender TEXT,
  contact TEXT NOT NULL,
  wechat TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建活动领队关系表
CREATE TABLE IF NOT EXISTS activity_leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  leader_id UUID NOT NULL REFERENCES leaders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(activity_id, leader_id)
);

-- 修改活动参与人员表,添加新字段
ALTER TABLE activity_participants 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT '待确认',
ADD COLUMN IF NOT EXISTS salary DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS deposit DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS per_head_fee DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS introducer_id UUID REFERENCES leaders(id) ON DELETE SET NULL;

-- 添加唯一约束: 一个人员在一个活动中只能有一个介绍人(通过activity_id和person_id已经是唯一的)
-- 这个约束已经通过UNIQUE(activity_id, person_id)保证了

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_leaders_name ON leaders(name);
CREATE INDEX IF NOT EXISTS idx_activity_leaders_activity ON activity_leaders(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_leaders_leader ON activity_leaders(leader_id);
CREATE INDEX IF NOT EXISTS idx_participants_introducer ON activity_participants(introducer_id);

-- 更新触发器
CREATE OR REPLACE FUNCTION update_leaders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leaders_updated_at
BEFORE UPDATE ON leaders
FOR EACH ROW
EXECUTE FUNCTION update_leaders_updated_at();

-- RLS策略 (公开访问)
ALTER TABLE leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_leaders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "允许所有人查看领队" ON leaders FOR SELECT USING (true);
CREATE POLICY "允许所有人插入领队" ON leaders FOR INSERT WITH CHECK (true);
CREATE POLICY "允许所有人更新领队" ON leaders FOR UPDATE USING (true);
CREATE POLICY "允许所有人删除领队" ON leaders FOR DELETE USING (true);

CREATE POLICY "允许所有人查看活动领队关系" ON activity_leaders FOR SELECT USING (true);
CREATE POLICY "允许所有人插入活动领队关系" ON activity_leaders FOR INSERT WITH CHECK (true);
CREATE POLICY "允许所有人更新活动领队关系" ON activity_leaders FOR UPDATE USING (true);
CREATE POLICY "允许所有人删除活动领队关系" ON activity_leaders FOR DELETE USING (true);