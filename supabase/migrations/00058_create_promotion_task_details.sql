-- 实际推广详情表，与推广任务记录一对一
CREATE TABLE public.promotion_task_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.promotion_task_records(id) ON DELETE CASCADE,
  actual_time timestamptz,
  activity_id uuid REFERENCES public.activities(id),
  channel text,
  conversions integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(record_id)
);

ALTER TABLE public.promotion_task_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view promotion task details" ON public.promotion_task_details FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert promotion task details" ON public.promotion_task_details FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update promotion task details" ON public.promotion_task_details FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete promotion task details" ON public.promotion_task_details FOR DELETE USING (true);

-- 数据迁移：将 records 中的 actual_time、conversions 迁入详情表
INSERT INTO public.promotion_task_details (record_id, actual_time, conversions)
SELECT id, actual_time, conversions FROM public.promotion_task_records;

-- 从记录表移除已迁出的字段
ALTER TABLE public.promotion_task_records DROP COLUMN actual_time;
ALTER TABLE public.promotion_task_records DROP COLUMN conversions;