ALTER TABLE promotion_tasks ADD COLUMN cycle_type text NOT NULL DEFAULT '长期任务';
ALTER TABLE promotion_tasks ADD COLUMN start_date date;
ALTER TABLE promotion_tasks ADD COLUMN end_date date;
ALTER TABLE promotion_tasks ADD COLUMN cycle_interval integer;
UPDATE promotion_tasks SET cycle_type = '长期任务';
ALTER TABLE promotion_tasks DROP COLUMN is_default;