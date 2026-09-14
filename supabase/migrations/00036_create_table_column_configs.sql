-- 创建表格列配置表
CREATE TABLE IF NOT EXISTS table_column_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_name TEXT NOT NULL,
  column_key TEXT NOT NULL,
  column_label TEXT NOT NULL,
  visible BOOLEAN DEFAULT true,
  order_index INTEGER NOT NULL,
  width INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(page_name, column_key)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_table_column_configs_page ON table_column_configs(page_name);
CREATE INDEX IF NOT EXISTS idx_table_column_configs_order ON table_column_configs(page_name, order_index);

-- 启用 RLS
ALTER TABLE table_column_configs ENABLE ROW LEVEL SECURITY;

-- RLS 策略：所有用户可以查看配置
CREATE POLICY "所有用户可以查看列配置"
  ON table_column_configs FOR SELECT
  USING (true);

-- RLS 策略：只有 root 用户可以修改配置
CREATE POLICY "root用户可以修改列配置"
  ON table_column_configs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.username = 'root'
    )
  );

-- 插入默认配置（活动管理页面）
INSERT INTO table_column_configs (page_name, column_key, column_label, visible, order_index) VALUES
  ('activities', 'name', '活动名称', true, 1),
  ('activities', 'activity_type_name', '活动类型', true, 2),
  ('activities', 'status', '状态', true, 3),
  ('activities', 'start_date', '开始日期', true, 4),
  ('activities', 'location', '地点', true, 5),
  ('activities', 'required_people', '需求人数', true, 6),
  ('activities', 'participant_count', '已报名', true, 7),
  ('activities', 'part_time_salary', '兼职工资', true, 8),
  ('activities', 'per_head_fee', '人头费', true, 9),
  ('activities', 'deposit', '押金', false, 10),
  ('activities', 'registration_method', '报名方式', false, 11),
  ('activities', 'notes', '备注', false, 12)
ON CONFLICT (page_name, column_key) DO NOTHING;

-- 插入默认配置（人员管理页面）
INSERT INTO table_column_configs (page_name, column_key, column_label, visible, order_index) VALUES
  ('persons', 'name', '姓名', true, 1),
  ('persons', 'contact', '联系方式', true, 2),
  ('persons', 'gender', '性别', true, 3),
  ('persons', 'age', '年龄', true, 4),
  ('persons', 'height', '身高', false, 5),
  ('persons', 'weight', '体重', false, 6),
  ('persons', 'id_number', '身份证号', false, 7),
  ('persons', 'expertise', '擅长领域', true, 8),
  ('persons', 'notes', '备注', false, 9)
ON CONFLICT (page_name, column_key) DO NOTHING;

-- 插入默认配置（领队管理页面）
INSERT INTO table_column_configs (page_name, column_key, column_label, visible, order_index) VALUES
  ('leaders', 'name', '姓名', true, 1),
  ('leaders', 'gender', '性别', true, 2),
  ('leaders', 'contact', '联系方式', true, 3),
  ('leaders', 'wechat', '微信', true, 4),
  ('leaders', 'notes', '备注', false, 5)
ON CONFLICT (page_name, column_key) DO NOTHING;

-- 插入默认配置（参与人员管理页面）
INSERT INTO table_column_configs (page_name, column_key, column_label, visible, order_index) VALUES
  ('participations', 'activity_name', '活动名称', true, 1),
  ('participations', 'person_name', '人员姓名', true, 2),
  ('participations', 'status', '出席状态', true, 3),
  ('participations', 'salary', '工资', true, 4),
  ('participations', 'deposit', '押金', true, 5),
  ('participations', 'per_head_fee', '人头费', true, 6),
  ('participations', 'introducer_name', '介绍人', true, 7)
ON CONFLICT (page_name, column_key) DO NOTHING;

-- 添加注释
COMMENT ON TABLE table_column_configs IS '表格列配置表';
COMMENT ON COLUMN table_column_configs.page_name IS '页面名称（如：activities、persons、leaders等）';
COMMENT ON COLUMN table_column_configs.column_key IS '列键名（对应数据字段）';
COMMENT ON COLUMN table_column_configs.column_label IS '列标签（显示名称）';
COMMENT ON COLUMN table_column_configs.visible IS '是否显示';
COMMENT ON COLUMN table_column_configs.order_index IS '排序索引';
COMMENT ON COLUMN table_column_configs.width IS '列宽度（像素）';