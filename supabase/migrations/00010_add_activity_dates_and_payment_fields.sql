-- 重命名activities表的date字段为start_date
ALTER TABLE activities RENAME COLUMN date TO start_date;

-- 添加end_date和payment_date字段
ALTER TABLE activities 
ADD COLUMN end_date DATE,
ADD COLUMN payment_date DATE;

-- 添加注释
COMMENT ON COLUMN activities.start_date IS '开始日期';
COMMENT ON COLUMN activities.end_date IS '结束日期';
COMMENT ON COLUMN activities.payment_date IS '发薪日期';

-- 为activity_participants表添加is_paid字段
ALTER TABLE activity_participants
ADD COLUMN is_paid BOOLEAN DEFAULT false NOT NULL;

-- 添加注释
COMMENT ON COLUMN activity_participants.is_paid IS '是否发薪';