-- 为activity_participants表添加UPDATE策略
CREATE POLICY "Allow public update activity_participants"
ON activity_participants
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);