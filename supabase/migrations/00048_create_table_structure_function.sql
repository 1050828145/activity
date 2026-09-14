-- 创建获取表结构的函数
CREATE OR REPLACE FUNCTION get_table_structure(table_name_param text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  -- 获取表的列信息和主键信息
  SELECT json_build_object(
    'columns', (
      SELECT json_agg(
        json_build_object(
          'column_name', column_name,
          'data_type', data_type,
          'character_maximum_length', character_maximum_length,
          'is_nullable', is_nullable,
          'column_default', column_default
        ) ORDER BY ordinal_position
      )
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = table_name_param
    ),
    'primary_keys', (
      SELECT json_agg(a.attname ORDER BY array_position(i.indkey, a.attnum))
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = table_name_param::regclass 
        AND i.indisprimary
    )
  ) INTO result;
  
  RETURN result;
END;
$$;