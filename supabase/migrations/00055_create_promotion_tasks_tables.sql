-- 推广任务设置表
CREATE TABLE promotion_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_common boolean NOT NULL DEFAULT false,
  task_list text,
  is_default boolean NOT NULL DEFAULT false,
  promotion_time time NOT NULL DEFAULT '09:00',
  status text NOT NULL DEFAULT '启用' CHECK (status IN ('启用', '停用')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 推广任务每日执行记录表
CREATE TABLE promotion_task_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES promotion_tasks(id) ON DELETE CASCADE,
  record_date date NOT NULL,
  actual_time timestamptz,
  conversions integer NOT NULL DEFAULT 0,
  is_completed boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, record_date)
);

-- RLS
ALTER TABLE promotion_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_task_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view promotion tasks" ON promotion_tasks FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users can insert promotion tasks" ON promotion_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update promotion tasks" ON promotion_tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete promotion tasks" ON promotion_tasks FOR DELETE TO authenticated USING (true);

CREATE POLICY "Anyone can view promotion task records" ON promotion_task_records FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users can insert promotion task records" ON promotion_task_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update promotion task records" ON promotion_task_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete promotion task records" ON promotion_task_records FOR DELETE TO authenticated USING (true);