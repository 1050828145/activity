-- 添加身高和体重字段到persons表
ALTER TABLE persons
ADD COLUMN height INTEGER,
ADD COLUMN weight NUMERIC(5,2);

-- 添加注释
COMMENT ON COLUMN persons.height IS '身高(cm)';
COMMENT ON COLUMN persons.weight IS '体重(kg)';