ALTER TABLE public.promotion_task_details DROP CONSTRAINT promotion_task_details_activity_id_fkey;
ALTER TABLE public.promotion_task_details RENAME COLUMN activity_id TO activity_ids;
ALTER TABLE public.promotion_task_details ALTER COLUMN activity_ids TYPE text USING COALESCE(activity_ids::text, '');
ALTER TABLE public.promotion_task_details ALTER COLUMN activity_ids SET DEFAULT '';