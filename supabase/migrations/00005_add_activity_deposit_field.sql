-- 给activities表添加押金字段
ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS deposit DECIMAL(10,2) DEFAULT 0;

-- 检查并确保所有表都有时间戳字段
-- activities表已有created_at和updated_at
-- persons表已有created_at和updated_at
-- leaders表已有created_at和updated_at
-- activity_participants表只有created_at,需要添加updated_at
ALTER TABLE activity_participants 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- activity_leaders表只有created_at,需要添加updated_at
ALTER TABLE activity_leaders 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 为activity_participants添加更新触发器
CREATE OR REPLACE FUNCTION update_activity_participants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS activity_participants_updated_at ON activity_participants;
CREATE TRIGGER activity_participants_updated_at
BEFORE UPDATE ON activity_participants
FOR EACH ROW
EXECUTE FUNCTION update_activity_participants_updated_at();

-- 为activity_leaders添加更新触发器
CREATE OR REPLACE FUNCTION update_activity_leaders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS activity_leaders_updated_at ON activity_leaders;
CREATE TRIGGER activity_leaders_updated_at
BEFORE UPDATE ON activity_leaders
FOR EACH ROW
EXECUTE FUNCTION update_activity_leaders_updated_at();