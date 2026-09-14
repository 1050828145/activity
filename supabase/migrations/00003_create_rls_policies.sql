-- 启用RLS
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_participants ENABLE ROW LEVEL SECURITY;

-- 活动表策略 - 允许所有人读取
CREATE POLICY "Allow public read activities"
ON activities FOR SELECT
TO public
USING (true);

-- 活动表策略 - 允许所有人插入
CREATE POLICY "Allow public insert activities"
ON activities FOR INSERT
TO public
WITH CHECK (true);

-- 活动表策略 - 允许所有人更新
CREATE POLICY "Allow public update activities"
ON activities FOR UPDATE
TO public
USING (true);

-- 活动表策略 - 允许所有人删除
CREATE POLICY "Allow public delete activities"
ON activities FOR DELETE
TO public
USING (true);

-- 人员表策略 - 允许所有人读取
CREATE POLICY "Allow public read persons"
ON persons FOR SELECT
TO public
USING (true);

-- 人员表策略 - 允许所有人插入
CREATE POLICY "Allow public insert persons"
ON persons FOR INSERT
TO public
WITH CHECK (true);

-- 人员表策略 - 允许所有人更新
CREATE POLICY "Allow public update persons"
ON persons FOR UPDATE
TO public
USING (true);

-- 人员表策略 - 允许所有人删除
CREATE POLICY "Allow public delete persons"
ON persons FOR DELETE
TO public
USING (true);

-- 关系表策略 - 允许所有人读取
CREATE POLICY "Allow public read activity_participants"
ON activity_participants FOR SELECT
TO public
USING (true);

-- 关系表策略 - 允许所有人插入
CREATE POLICY "Allow public insert activity_participants"
ON activity_participants FOR INSERT
TO public
WITH CHECK (true);

-- 关系表策略 - 允许所有人删除
CREATE POLICY "Allow public delete activity_participants"
ON activity_participants FOR DELETE
TO public
USING (true);