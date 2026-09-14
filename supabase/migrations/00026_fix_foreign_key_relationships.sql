-- 为 activity_participants 表添加外键关联
ALTER TABLE activity_participants 
ADD CONSTRAINT activity_participants_activity_id_fkey 
FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE;

ALTER TABLE activity_participants 
ADD CONSTRAINT activity_participants_person_id_fkey 
FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE;

ALTER TABLE activity_participants 
ADD CONSTRAINT activity_participants_introducer_id_fkey 
FOREIGN KEY (introducer_id) REFERENCES persons(id) ON DELETE SET NULL;

-- 为 activity_leaders 表添加外键关联
ALTER TABLE activity_leaders 
ADD CONSTRAINT activity_leaders_activity_id_fkey 
FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE;

ALTER TABLE activity_leaders 
ADD CONSTRAINT activity_leaders_leader_id_fkey 
FOREIGN KEY (leader_id) REFERENCES leaders(id) ON DELETE CASCADE;
