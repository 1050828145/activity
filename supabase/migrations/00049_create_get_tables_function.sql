-- 创建获取表列表的函数
CREATE OR REPLACE FUNCTION get_user_tables()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(table_name ORDER BY table_name)
  INTO result
  FROM information_schema.tables
  WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name NOT IN (
      'pg_stat_statements',
      'pg_stat_statements_info',
      'schema_migrations',
      'supabase_functions',
      'supabase_migrations',
      'storage',
      'auth',
      'realtime',
      'extensions',
      'graphql',
      'graphql_public',
      'net',
      'pgsodium',
      'pgsodium_masks',
      'pgtle',
      'vault',
      'supabase_functions_schema',
      'backup_logs'
    );
  
  RETURN result;
END;
$$;