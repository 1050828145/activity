
-- 删除所有表的约束
-- 按照依赖关系的正确顺序删除

-- 1. 先删除 activity_participants 表的外键约束
ALTER TABLE activity_participants DROP CONSTRAINT IF EXISTS activity_participants_activity_id_fkey;
ALTER TABLE activity_participants DROP CONSTRAINT IF EXISTS activity_participants_person_id_fkey;
ALTER TABLE activity_participants DROP CONSTRAINT IF EXISTS activity_participants_introducer_id_fkey;

-- 2. 删除 activity_leaders 表的外键约束
ALTER TABLE activity_leaders DROP CONSTRAINT IF EXISTS activity_leaders_activity_id_fkey;
ALTER TABLE activity_leaders DROP CONSTRAINT IF EXISTS activity_leaders_leader_id_fkey;

-- 3. 删除 activities 表的外键约束
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_user_id_fkey;

-- 4. 删除 persons 表的外键约束
ALTER TABLE persons DROP CONSTRAINT IF EXISTS persons_user_id_fkey;

-- 5. 删除 leaders 表的外键约束
ALTER TABLE leaders DROP CONSTRAINT IF EXISTS leaders_user_id_fkey;

-- 6. 删除 profiles 表的外键约束
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 7. 删除唯一约束
ALTER TABLE activity_participants DROP CONSTRAINT IF EXISTS activity_participants_activity_id_person_id_key;
ALTER TABLE activity_leaders DROP CONSTRAINT IF EXISTS activity_leaders_activity_id_leader_id_key;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_username_key;

-- 8. 删除主键约束
ALTER TABLE activity_participants DROP CONSTRAINT IF EXISTS activity_participants_pkey;
ALTER TABLE activity_leaders DROP CONSTRAINT IF EXISTS activity_leaders_pkey;
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_pkey;
ALTER TABLE persons DROP CONSTRAINT IF EXISTS persons_pkey;
ALTER TABLE leaders DROP CONSTRAINT IF EXISTS leaders_pkey;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_pkey;
