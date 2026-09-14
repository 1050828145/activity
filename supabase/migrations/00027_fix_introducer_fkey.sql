-- 删除指向 persons 的错误外键
ALTER TABLE activity_participants 
DROP CONSTRAINT IF EXISTS activity_participants_introducer_id_fkey;

-- 创建指向 leaders 的正确外键
ALTER TABLE activity_participants 
ADD CONSTRAINT activity_participants_introducer_id_fkey 
FOREIGN KEY (introducer_id) REFERENCES leaders(id) ON DELETE SET NULL;
