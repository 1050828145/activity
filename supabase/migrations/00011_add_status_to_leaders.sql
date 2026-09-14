-- 为leaders表添加status字段
ALTER TABLE leaders ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT '在职';

-- 为现有记录设置默认值
UPDATE leaders SET status = '在职' WHERE status IS NULL;