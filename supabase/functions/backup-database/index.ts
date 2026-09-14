import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SYSTEM_TABLES = [
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
];

// 公共数据表（不按用户分组）
const PUBLIC_TABLES = [
  'activity_types',
  'system_settings',
  'email_config',
  'scheduled_tasks',
  'scheduler_locks',
  'table_column_configs',
];

// 用户数据表（按 user_id 或 created_by 分组）
const USER_DATA_TABLES = [
  'activities',
  'persons',
  'leaders',
  'activity_participants',
  'activity_leaders',
  'leader_participants',
  'email_notifications',
  'email_send_logs',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('未授权');
    }

    // 验证用户身份
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('用户验证失败');
    }

    // 获取用户信息
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      throw new Error('用户信息不存在');
    }

    // 检查是否为 root 用户
    const isRoot = profile.username === 'root' || profile.role === 'admin';
    if (!isRoot) {
      throw new Error('仅 root 用户可以执行数据备份');
    }

    // 获取所有用户表
    console.log('开始获取表列表...');
    
    const { data: tablesData, error: tablesError } = await supabase.rpc('get_user_tables');
    
    if (tablesError) {
      console.error('获取表列表失败:', tablesError);
      throw new Error('获取表列表失败: ' + tablesError.message);
    }

    const tables: string[] = tablesData || [];
    
    console.log(`获取到 ${tables.length} 个表:`, tables);

    if (tables.length === 0) {
      throw new Error('没有找到任何可备份的表');
    }

    // 执行备份
    const result = await processBackup(tables, supabase, user, profile);
    
    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('备份失败:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || '备份失败',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function processBackup(
  tables: string[],
  supabase: any,
  user: any,
  profile: any
) {
  try {
    const backupTime = new Date().toISOString();
    let sqlContent = `-- 数据库备份文件\n`;
    sqlContent += `-- 备份时间: ${backupTime}\n`;
    sqlContent += `-- 备份用户: ${profile.username}\n`;
    sqlContent += `-- 包含: 表结构 + 数据\n\n`;

    console.log(`开始备份，共 ${tables.length} 个表`);

    // 0. 备份表结构
    sqlContent += `-- ==================== 表结构 ====================\n\n`;
    
    let structureBackupCount = 0;
    for (const tableName of tables) {
      try {
        console.log(`获取表结构: ${tableName}`);
        
        // 使用新的 RPC 函数获取表结构
        const { data: structureData, error: structureError } = await supabase.rpc('get_table_structure', {
          table_name_param: tableName
        });

        if (structureError) {
          console.error(`获取表 ${tableName} 结构失败:`, structureError);
          console.error('错误详情:', JSON.stringify(structureError));
          continue;
        }

        console.log(`表 ${tableName} 结构数据:`, JSON.stringify(structureData));

        if (!structureData || !structureData.columns || structureData.columns.length === 0) {
          console.log(`表 ${tableName} 无列信息`);
          continue;
        }

        const columns = structureData.columns;
        const primaryKeys = structureData.primary_keys || [];

        // 生成 CREATE TABLE 语句
        sqlContent += `-- 表: ${tableName}\n`;
        sqlContent += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
        
        const columnDefs = columns.map((col: any) => {
          let def = `  ${col.column_name} ${col.data_type}`;
          
          // 添加长度限制
          if (col.character_maximum_length && ['character varying', 'varchar', 'char'].includes(col.data_type)) {
            def += `(${col.character_maximum_length})`;
          }
          
          // 添加 NOT NULL 约束
          if (col.is_nullable === 'NO') {
            def += ' NOT NULL';
          }
          
          // 添加默认值
          if (col.column_default) {
            def += ` DEFAULT ${col.column_default}`;
          }
          
          return def;
        });
        
        // 添加主键约束
        if (primaryKeys.length > 0) {
          columnDefs.push(`  PRIMARY KEY (${primaryKeys.join(', ')})`);
        }
        
        sqlContent += columnDefs.join(',\n');
        sqlContent += `\n);\n\n`;
        
        structureBackupCount++;
        console.log(`表 ${tableName} 结构备份完成 (${structureBackupCount}/${tables.length})`);
      } catch (err) {
        console.error(`备份表 ${tableName} 结构失败:`, err);
        console.error('错误堆栈:', err);
      }
    }

    console.log(`表结构备份完成，共备份 ${structureBackupCount} 个表`);

    // 1. 备份公共数据
    sqlContent += `-- ==================== 公共数据 ====================\n\n`;
    
    let publicDataBackupCount = 0;
    for (const tableName of tables.filter(t => PUBLIC_TABLES.includes(t))) {
      try {
        console.log(`备份公共表: ${tableName}`);
        const { data: rows, error } = await supabase
          .from(tableName)
          .select('*');

        if (error) {
          console.error(`查询表 ${tableName} 失败:`, error);
          continue;
        }

        if (!rows || rows.length === 0) {
          sqlContent += `-- 表 ${tableName} 无数据\n\n`;
          console.log(`表 ${tableName} 无数据`);
          continue;
        }

        sqlContent += `-- 表: ${tableName} (${rows.length} 条记录)\n`;
        console.log(`表 ${tableName} 有 ${rows.length} 条记录`);

        for (const row of rows) {
          const columns = Object.keys(row);
          const values = columns.map(col => {
            const val = row[col];
            if (val === null) return 'NULL';
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            if (typeof val === 'boolean') return val ? 'true' : 'false';
            if (val instanceof Date) return `'${val.toISOString()}'`;
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
            return val;
          });

          sqlContent += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
        }

        sqlContent += `\n`;
        publicDataBackupCount++;
      } catch (err) {
        console.error(`备份表 ${tableName} 失败:`, err);
      }
    }

    console.log(`公共数据备份完成，共备份 ${publicDataBackupCount} 个表`);

    // 2. 备份用户数据（仅备份当前用户的数据）
    sqlContent += `-- ==================== 用户数据 (用户: ${profile.username}) ====================\n\n`;

    let userDataBackupCount = 0;
    for (const tableName of tables.filter(t => USER_DATA_TABLES.includes(t))) {
      try {
        console.log(`备份用户表: ${tableName}`);
        // 直接尝试查询，根据常见的用户字段
        let rows = null;
        let queryError = null;
        
        // 先尝试 user_id
        const { data: rowsWithUserId, error: userIdError } = await supabase
          .from(tableName)
          .select('*')
          .eq('user_id', user.id);
        
        if (!userIdError && rowsWithUserId) {
          rows = rowsWithUserId;
        } else {
          // 如果 user_id 失败，尝试 created_by
          const { data: rowsWithCreatedBy, error: createdByError } = await supabase
            .from(tableName)
            .select('*')
            .eq('created_by', user.id);
          
          if (!createdByError && rowsWithCreatedBy) {
            rows = rowsWithCreatedBy;
          } else {
            queryError = userIdError || createdByError;
          }
        }

        if (queryError) {
          console.error(`查询表 ${tableName} 失败:`, queryError);
          continue;
        }

        if (!rows || rows.length === 0) {
          sqlContent += `-- 表 ${tableName} 无数据\n\n`;
          console.log(`表 ${tableName} 无数据`);
          continue;
        }

        sqlContent += `-- 表: ${tableName} (${rows.length} 条记录)\n`;
        console.log(`表 ${tableName} 有 ${rows.length} 条记录`);

        for (const row of rows) {
          const columns = Object.keys(row);
          const values = columns.map(col => {
            const val = row[col];
            if (val === null) return 'NULL';
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            if (typeof val === 'boolean') return val ? 'true' : 'false';
            if (val instanceof Date) return `'${val.toISOString()}'`;
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
            return val;
          });

          sqlContent += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;\n`;
        }

        sqlContent += `\n`;
        userDataBackupCount++;
      } catch (err) {
        console.error(`备份表 ${tableName} 失败:`, err);
      }
    }

    console.log(`用户数据备份完成，共备份 ${userDataBackupCount} 个表`);

    // 3. 备份其他表（不在公共和用户数据列表中的表）
    const otherTables = tables.filter(t => !PUBLIC_TABLES.includes(t) && !USER_DATA_TABLES.includes(t));
    let otherDataBackupCount = 0;
    
    if (otherTables.length > 0) {
      sqlContent += `-- ==================== 其他数据 ====================\n\n`;
      console.log(`发现 ${otherTables.length} 个其他表:`, otherTables);

      for (const tableName of otherTables) {
        try {
          console.log(`备份其他表: ${tableName}`);
          const { data: rows, error } = await supabase
            .from(tableName)
            .select('*');

          if (error) {
            console.error(`查询表 ${tableName} 失败:`, error);
            continue;
          }

          if (!rows || rows.length === 0) {
            sqlContent += `-- 表 ${tableName} 无数据\n\n`;
            console.log(`表 ${tableName} 无数据`);
            continue;
          }

          sqlContent += `-- 表: ${tableName} (${rows.length} 条记录)\n`;
          console.log(`表 ${tableName} 有 ${rows.length} 条记录`);

          for (const row of rows) {
            const columns = Object.keys(row);
            const values = columns.map(col => {
              const val = row[col];
              if (val === null) return 'NULL';
              if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
              if (typeof val === 'boolean') return val ? 'true' : 'false';
              if (val instanceof Date) return `'${val.toISOString()}'`;
              if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
              return val;
            });

            sqlContent += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;\n`;
          }

          sqlContent += `\n`;
          otherDataBackupCount++;
        } catch (err) {
          console.error(`备份表 ${tableName} 失败:`, err);
        }
      }
    }

    console.log(`其他数据备份完成，共备份 ${otherDataBackupCount} 个表`);

    // 统计总备份数量
    const totalBackupCount = structureBackupCount;
    const totalDataBackupCount = publicDataBackupCount + userDataBackupCount + otherDataBackupCount;
    
    console.log('='.repeat(50));
    console.log(`备份统计:`);
    console.log(`- 总表数: ${tables.length}`);
    console.log(`- 表结构备份: ${structureBackupCount} 个`);
    console.log(`- 数据备份: ${totalDataBackupCount} 个 (公共:${publicDataBackupCount} + 用户:${userDataBackupCount} + 其他:${otherDataBackupCount})`);
    console.log('='.repeat(50));

    console.log('备份完成，生成文件名');

    // 生成文件名
    const filename = `backup_${backupTime.replace(/[:.]/g, '-').replace('T', '_').substring(0, 19)}.sql`;

    console.log(`保存备份日志: ${filename}`);

    // 记录备份日志（保存 SQL 内容）
    const { error: logError } = await supabase
      .from('backup_logs')
      .insert({
        user_id: user.id,
        filename: filename,
        status: 'success',
        file_content: sqlContent,
      });

    if (logError) {
      console.error('记录备份日志失败:', logError);
    }

    // 清理旧备份记录（保留最新5条）
    const { data: oldLogs } = await supabase
      .from('backup_logs')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(5, 1000);

    if (oldLogs && oldLogs.length > 0) {
      const idsToDelete = oldLogs.map((log: any) => log.id);
      await supabase
        .from('backup_logs')
        .delete()
        .in('id', idsToDelete);
    }

    return {
      success: true,
      sql: sqlContent,
      filename: filename,
      tableCount: totalBackupCount,
      dataTableCount: totalDataBackupCount,
      timestamp: backupTime,
    };
  } catch (err) {
    console.error(`处理备份失败:`, err);
    throw err;
  }
}
