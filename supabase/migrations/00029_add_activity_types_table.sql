-- 创建活动类型表
CREATE TABLE IF NOT EXISTS activity_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 插入默认活动类型
INSERT INTO activity_types (name, description) VALUES
  ('促销活动', '商场、超市等促销推广活动'),
  ('展会活动', '各类展览会、博览会'),
  ('会议活动', '企业会议、论坛、峰会等'),
  ('演出活动', '演唱会、话剧、音乐会等'),
  ('体育赛事', '马拉松、球赛等体育活动'),
  ('培训活动', '企业培训、讲座等'),
  ('其他', '其他类型活动')
ON CONFLICT (name) DO NOTHING;

-- 为 activities 表添加 activity_type_id 字段
ALTER TABLE activities ADD COLUMN IF NOT EXISTS activity_type_id UUID REFERENCES activity_types(id) ON DELETE SET NULL;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_activities_activity_type_id ON activities(activity_type_id);

-- 启用 RLS
ALTER TABLE activity_types ENABLE ROW LEVEL SECURITY;

-- 活动类型表的 RLS 策略（所有人可读，只有管理员可写）
CREATE POLICY "Anyone can view activity types"
  ON activity_types FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert activity types"
  ON activity_types FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update activity types"
  ON activity_types FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete activity types"
  ON activity_types FOR DELETE
  USING (auth.uid() IS NOT NULL);