-- 创建执行 SQL 的辅助函数（用于备份功能）
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS TABLE(result json)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY EXECUTE 'SELECT row_to_json(t) FROM (' || sql || ') t';
END;
$$;
