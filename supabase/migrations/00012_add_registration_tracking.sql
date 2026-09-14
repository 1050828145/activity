-- 为activity_participants表添加报名来源和查看状态字段
ALTER TABLE activity_participants 
ADD COLUMN IF NOT EXISTS registration_source VARCHAR(50) DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS is_viewed BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;

-- 添加注释
COMMENT ON COLUMN activity_participants.registration_source IS '报名来源: manual(手动添加), qrcode(二维码报名)';
COMMENT ON COLUMN activity_participants.is_viewed IS '是否已查看: true(已查看), false(待查看)';
COMMENT ON COLUMN activity_participants.viewed_at IS '查看时间';

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_participants_pending ON activity_participants(is_viewed, registration_source) 
WHERE is_viewed = false AND registration_source = 'qrcode';
