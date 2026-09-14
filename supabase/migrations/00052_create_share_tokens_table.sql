-- 创建分享链接 token 表（无固定过期时间，只要服务运行就有效）
CREATE TABLE share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text, -- 备注，如"分享给XXX"
  visit_count integer NOT NULL DEFAULT 0, -- 访问次数统计
  is_active boolean NOT NULL DEFAULT true, -- 是否有效（true=有效，false=已禁用）
  last_visited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_share_tokens_token ON share_tokens(token);
CREATE INDEX idx_share_tokens_created_by ON share_tokens(created_by);

ALTER TABLE share_tokens ENABLE ROW LEVEL SECURITY;

-- 只有创建者可以查看/管理自己的 token
CREATE POLICY "创建者可以查看自己的分享token"
  ON share_tokens FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "已登录用户可以创建分享token"
  ON share_tokens FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "创建者可以更新自己的分享token"
  ON share_tokens FOR UPDATE
  USING (created_by = auth.uid());

-- 公开验证 token 有效性（无需认证）
CREATE OR REPLACE FUNCTION verify_share_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record share_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v_record
  FROM share_tokens
  WHERE token = p_token AND is_active = true;

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false);
  END IF;

  -- 更新访问统计
  UPDATE share_tokens
  SET 
    visit_count = visit_count + 1,
    last_visited_at = now(),
    updated_at = now()
  WHERE id = v_record.id;

  RETURN json_build_object(
    'valid', true,
    'label', v_record.label,
    'created_at', v_record.created_at
  );
END;
$$;

COMMENT ON TABLE share_tokens IS '应用分享链接 token，无固定过期时间，只要服务运行链接就有效';
COMMENT ON COLUMN share_tokens.is_active IS '是否有效：true=有效（链接可访问），false=已禁用（链接失效）';
COMMENT ON COLUMN share_tokens.token IS '唯一分享码，48位十六进制字符串';