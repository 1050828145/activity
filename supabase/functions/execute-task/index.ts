import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TaskExecutionRequest {
  task_id: string;
  task_type: string;
  task_config?: Record<string, any>;
}

Deno.serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { task_id, task_type, task_config } = await req.json() as TaskExecutionRequest;

    console.log(`执行任务: ${task_id}, 类型: ${task_type}`);

    const startTime = new Date();
    let status: 'success' | 'failed' = 'success';
    let errorMessage: string | null = null;
    let executionDetails: Record<string, any> = {};

    try {
      // 根据任务类型执行不同的逻辑
      switch (task_type) {
        case 'send_email':
          executionDetails = await executeSendEmailTask(supabase, task_config);
          break;
        
        case 'data_cleanup':
          executionDetails = await executeDataCleanupTask(supabase, task_config);
          break;
        
        case 'report_generation':
          executionDetails = await executeReportGenerationTask(supabase, task_config);
          break;
        
        case 'custom':
          executionDetails = await executeCustomTask(supabase, task_config);
          break;
        
        default:
          throw new Error(`未知的任务类型: ${task_type}`);
      }
    } catch (error: any) {
      status = 'failed';
      errorMessage = error.message || '任务执行失败';
      console.error('任务执行错误:', error);
    }

    const completedTime = new Date();

    // 记录执行日志
    const { error: logError } = await supabase
      .from('task_execution_logs')
      .insert({
        task_id,
        status,
        started_at: startTime.toISOString(),
        completed_at: completedTime.toISOString(),
        error_message: errorMessage,
        execution_details: executionDetails,
      });

    if (logError) {
      console.error('记录日志失败:', logError);
    }

    // 更新任务的最后执行时间
    const { error: updateError } = await supabase.rpc('update_task_execution_time', {
      p_task_id: task_id,
      p_execution_time: startTime.toISOString(),
    });

    if (updateError) {
      console.error('更新任务执行时间失败:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: status === 'success',
        message: status === 'success' ? '任务执行成功' : errorMessage,
        execution_details: executionDetails,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Edge Function 错误:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || '服务器错误',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

// 执行发送邮件任务
async function executeSendEmailTask(
  supabase: any,
  config?: Record<string, any>
): Promise<Record<string, any>> {
  console.log('执行发送邮件任务', config);
  
  // 这里可以调用邮件发送逻辑
  // 例如：调用 send-scheduled-email Edge Function
  
  return {
    type: 'send_email',
    message: '邮件发送任务已执行',
    config,
  };
}

// 执行数据清理任务
async function executeDataCleanupTask(
  supabase: any,
  config?: Record<string, any>
): Promise<Record<string, any>> {
  console.log('执行数据清理任务', config);
  
  // 示例：清理过期的执行日志（保留最近 30 天）
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const { data, error } = await supabase
    .from('task_execution_logs')
    .delete()
    .lt('started_at', thirtyDaysAgo.toISOString());
  
  if (error) {
    throw new Error(`数据清理失败: ${error.message}`);
  }
  
  return {
    type: 'data_cleanup',
    message: '数据清理任务已执行',
    cleaned_records: data?.length || 0,
    config,
  };
}

// 执行报表生成任务
async function executeReportGenerationTask(
  supabase: any,
  config?: Record<string, any>
): Promise<Record<string, any>> {
  console.log('执行报表生成任务', config);
  
  // 这里可以实现报表生成逻辑
  // 例如：统计活动数据、人员数据等
  
  return {
    type: 'report_generation',
    message: '报表生成任务已执行',
    config,
  };
}

// 执行自定义任务
async function executeCustomTask(
  supabase: any,
  config?: Record<string, any>
): Promise<Record<string, any>> {
  console.log('执行自定义任务', config);
  
  // 自定义任务逻辑
  
  return {
    type: 'custom',
    message: '自定义任务已执行',
    config,
  };
}
