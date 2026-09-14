-- 为leaders表添加age字段
ALTER TABLE leaders ADD COLUMN age INTEGER;

-- 添加注释
COMMENT ON COLUMN leaders.age IS '年龄';