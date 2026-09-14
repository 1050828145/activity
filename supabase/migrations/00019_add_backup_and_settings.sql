
-- 在 profiles 表中增加自动备份开关，默认为开启
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auto_backup BOOLEAN DEFAULT TRUE;

-- 创建备份日志表
CREATE TABLE IF NOT EXISTS backup_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'success',
    file_content TEXT -- 存储生成的 SQL 内容（模拟）
);

-- 允许用户查看自己的备份日志
ALTER TABLE backup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own backup logs" ON backup_logs
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own backup logs" ON backup_logs
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
