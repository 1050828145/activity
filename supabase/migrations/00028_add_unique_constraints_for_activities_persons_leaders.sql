-- 为活动表的名称字段添加唯一约束
-- 首先检查是否存在重复数据
DO $$
BEGIN
  -- 如果存在重复的活动名称，给它们添加后缀
  WITH duplicates AS (
    SELECT name, COUNT(*) as cnt
    FROM activities
    GROUP BY name
    HAVING COUNT(*) > 1
  )
  UPDATE activities a
  SET name = a.name || ' (' || a.id::text || ')'
  FROM duplicates d
  WHERE a.name = d.name
  AND a.id NOT IN (
    SELECT id FROM activities a2 WHERE a2.name = d.name ORDER BY created_at LIMIT 1
  );
END $$;

-- 添加活动名称唯一约束
ALTER TABLE activities ADD CONSTRAINT activities_name_unique UNIQUE (name);

-- 为人员表添加姓名和电话的复合唯一约束
-- 首先检查是否存在重复数据
DO $$
BEGIN
  -- 如果存在重复的人员（姓名+电话），给它们添加后缀
  WITH duplicates AS (
    SELECT name, contact, COUNT(*) as cnt
    FROM persons
    WHERE contact IS NOT NULL AND contact != ''
    GROUP BY name, contact
    HAVING COUNT(*) > 1
  )
  UPDATE persons p
  SET name = p.name || ' (' || p.id::text || ')'
  FROM duplicates d
  WHERE p.name = d.name AND p.contact = d.contact
  AND p.id NOT IN (
    SELECT id FROM persons p2 
    WHERE p2.name = d.name AND p2.contact = d.contact 
    ORDER BY created_at LIMIT 1
  );
END $$;

-- 添加人员姓名和电话的复合唯一约束（只对非空电话生效）
CREATE UNIQUE INDEX persons_name_contact_unique 
ON persons (name, contact) 
WHERE contact IS NOT NULL AND contact != '';

-- 为领队表添加姓名和联系方式的复合唯一约束
-- 首先检查是否存在重复数据
DO $$
BEGIN
  -- 如果存在重复的领队（姓名+联系方式），给它们添加后缀
  WITH duplicates AS (
    SELECT name, contact, COUNT(*) as cnt
    FROM leaders
    WHERE contact IS NOT NULL AND contact != ''
    GROUP BY name, contact
    HAVING COUNT(*) > 1
  )
  UPDATE leaders l
  SET name = l.name || ' (' || l.id::text || ')'
  FROM duplicates d
  WHERE l.name = d.name AND l.contact = d.contact
  AND l.id NOT IN (
    SELECT id FROM leaders l2 
    WHERE l2.name = d.name AND l2.contact = d.contact 
    ORDER BY created_at LIMIT 1
  );
END $$;

-- 添加领队姓名和联系方式的复合唯一约束（只对非空联系方式生效）
CREATE UNIQUE INDEX leaders_name_contact_unique 
ON leaders (name, contact) 
WHERE contact IS NOT NULL AND contact != '';

-- 添加注释
COMMENT ON CONSTRAINT activities_name_unique ON activities IS '活动名称必须唯一';
COMMENT ON INDEX persons_name_contact_unique IS '人员的姓名和电话组合必须唯一';
COMMENT ON INDEX leaders_name_contact_unique IS '领队的姓名和联系方式组合必须唯一';
