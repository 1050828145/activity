
-- 恢复所有表的主键约束
ALTER TABLE activities ADD PRIMARY KEY (id);
ALTER TABLE persons ADD PRIMARY KEY (id);
ALTER TABLE leaders ADD PRIMARY KEY (id);
ALTER TABLE profiles ADD PRIMARY KEY (id);
ALTER TABLE activity_participants ADD PRIMARY KEY (id);
ALTER TABLE activity_leaders ADD PRIMARY KEY (id);

-- 恢复 profiles 的唯一约束(username通常需要唯一性以保证系统正常运行)
-- 如果用户坚持要删除所有除主键外的约束，这一步可以视情况而定
-- 但为了系统稳定性，先恢复主键。
