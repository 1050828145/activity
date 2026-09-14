-- 更新活动管理页面的列默认宽度
UPDATE table_column_configs SET width = 200 WHERE page_name = 'activities' AND column_key = 'name';
UPDATE table_column_configs SET width = 100 WHERE page_name = 'activities' AND column_key = 'activity_type_name';
UPDATE table_column_configs SET width = 100 WHERE page_name = 'activities' AND column_key = 'status';
UPDATE table_column_configs SET width = 140 WHERE page_name = 'activities' AND column_key = 'start_date';
UPDATE table_column_configs SET width = 200 WHERE page_name = 'activities' AND column_key = 'location';
UPDATE table_column_configs SET width = 100 WHERE page_name = 'activities' AND column_key = 'required_people';
UPDATE table_column_configs SET width = 100 WHERE page_name = 'activities' AND column_key = 'participant_count';
UPDATE table_column_configs SET width = 120 WHERE page_name = 'activities' AND column_key = 'part_time_salary';
UPDATE table_column_configs SET width = 100 WHERE page_name = 'activities' AND column_key = 'per_head_fee';
UPDATE table_column_configs SET width = 100 WHERE page_name = 'activities' AND column_key = 'deposit';
UPDATE table_column_configs SET width = 200 WHERE page_name = 'activities' AND column_key = 'registration_method';
UPDATE table_column_configs SET width = 200 WHERE page_name = 'activities' AND column_key = 'notes';

-- 更新人员管理页面的列默认宽度
UPDATE table_column_configs SET width = 120 WHERE page_name = 'persons' AND column_key = 'name';
UPDATE table_column_configs SET width = 150 WHERE page_name = 'persons' AND column_key = 'contact';
UPDATE table_column_configs SET width = 80 WHERE page_name = 'persons' AND column_key = 'gender';
UPDATE table_column_configs SET width = 80 WHERE page_name = 'persons' AND column_key = 'age';
UPDATE table_column_configs SET width = 80 WHERE page_name = 'persons' AND column_key = 'height';
UPDATE table_column_configs SET width = 80 WHERE page_name = 'persons' AND column_key = 'weight';
UPDATE table_column_configs SET width = 180 WHERE page_name = 'persons' AND column_key = 'id_number';
UPDATE table_column_configs SET width = 150 WHERE page_name = 'persons' AND column_key = 'expertise';
UPDATE table_column_configs SET width = 200 WHERE page_name = 'persons' AND column_key = 'notes';

-- 更新领队管理页面的列默认宽度
UPDATE table_column_configs SET width = 120 WHERE page_name = 'leaders' AND column_key = 'name';
UPDATE table_column_configs SET width = 80 WHERE page_name = 'leaders' AND column_key = 'gender';
UPDATE table_column_configs SET width = 150 WHERE page_name = 'leaders' AND column_key = 'contact';
UPDATE table_column_configs SET width = 150 WHERE page_name = 'leaders' AND column_key = 'wechat';
UPDATE table_column_configs SET width = 200 WHERE page_name = 'leaders' AND column_key = 'notes';

-- 更新参与人员管理页面的列默认宽度
UPDATE table_column_configs SET width = 200 WHERE page_name = 'participations' AND column_key = 'activity_name';
UPDATE table_column_configs SET width = 120 WHERE page_name = 'participations' AND column_key = 'person_name';
UPDATE table_column_configs SET width = 100 WHERE page_name = 'participations' AND column_key = 'status';
UPDATE table_column_configs SET width = 120 WHERE page_name = 'participations' AND column_key = 'salary';
UPDATE table_column_configs SET width = 100 WHERE page_name = 'participations' AND column_key = 'deposit';
UPDATE table_column_configs SET width = 100 WHERE page_name = 'participations' AND column_key = 'per_head_fee';
UPDATE table_column_configs SET width = 120 WHERE page_name = 'participations' AND column_key = 'introducer_name';

-- 添加注释
COMMENT ON COLUMN table_column_configs.width IS '列宽度（像素），NULL表示使用默认宽度';