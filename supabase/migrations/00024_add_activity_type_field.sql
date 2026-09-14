ALTER TABLE public.activities ADD COLUMN type TEXT DEFAULT '短期' NOT NULL;
COMMENT ON COLUMN public.activities.type IS '活动类型: 长期, 短期';
