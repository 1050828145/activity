import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailConfig {
  resend_api_key: string
  from_email: string
  from_name: string
}

interface EmailNotification {
  id: string
  user_id: string
  name: string
  enabled: boolean
  schedule_type: string
  schedule_time: string
  schedule_days: number[] | null
  content_types: string[]
}

Deno.serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 创建 Supabase 客户端（使用 service role key 以绕过 RLS）
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('开始检查定时邮件任务...')

    // 获取当前时间信息
    const now = new Date()
    const currentHour = now.getHours().toString().padStart(2, '0')
    const currentMinute = now.getMinutes().toString().padStart(2, '0')
    const currentTime = `${currentHour}:${currentMinute}`
    const currentDay = now.getDay() // 0=周日, 1=周一, ..., 6=周六

    console.log(`当前时间: ${currentTime}, 星期: ${currentDay}`)

    // 查询所有启用的通知任务
    const { data: notifications, error: notifError } = await supabase
      .from('email_notifications')
      .select('*')
      .eq('enabled', true)

    if (notifError) {
      console.error('查询通知任务失败:', notifError)
      throw notifError
    }

    if (!notifications || notifications.length === 0) {
      console.log('没有启用的通知任务')
      return new Response(
        JSON.stringify({ success: true, message: '没有启用的通知任务', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`找到 ${notifications.length} 个启用的通知任务`)

    // 获取邮件配置
    const { data: config, error: configError } = await supabase
      .from('email_config')
      .select('*')
      .maybeSingle()

    if (configError || !config) {
      console.error('获取邮箱配置失败:', configError)
      throw new Error('邮箱配置未设置')
    }

    // 筛选需要在当前时间发送的任务
    const tasksToSend: EmailNotification[] = []

    for (const notification of notifications) {
      // 检查时间是否匹配
      if (notification.schedule_time !== currentTime) {
        continue
      }

      // 检查日期是否匹配
      if (notification.schedule_type === 'daily') {
        // 每天发送
        tasksToSend.push(notification)
      } else if (notification.schedule_type === 'weekdays') {
        // 工作日发送（周一到周五）
        if (currentDay >= 1 && currentDay <= 5) {
          tasksToSend.push(notification)
        }
      } else if (notification.schedule_type === 'custom') {
        // 自定义日期
        if (notification.schedule_days && Array.isArray(notification.schedule_days)) {
          if (notification.schedule_days.includes(currentDay)) {
            tasksToSend.push(notification)
          }
        }
      }
    }

    console.log(`需要发送的任务数量: ${tasksToSend.length}`)

    if (tasksToSend.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: '当前时间没有需要发送的任务', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 发送邮件
    let sentCount = 0
    const errors: string[] = []

    for (const task of tasksToSend) {
      try {
        console.log(`处理任务: ${task.name} (ID: ${task.id})`)

        // 获取用户信息
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('email, username')
          .eq('id', task.user_id)
          .maybeSingle()

        if (profileError || !profile || !profile.email) {
          console.error(`用户 ${task.user_id} 信息获取失败或无邮箱`)
          errors.push(`任务 ${task.name}: 用户信息获取失败`)
          continue
        }

        // 采集数据
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayStr = today.toISOString()

        const contentTypes = task.content_types || []
        let registrations: any[] = []
        let todos: any[] = []
        let notes: any[] = []

        // 根据配置的内容类型采集数据
        if (contentTypes.includes('registrations')) {
          const { data } = await supabase
            .from('activity_registrations')
            .select(`
              *,
              activity:activities(name, date, location),
              person:persons(name, phone)
            `)
            .gte('created_at', todayStr)
            .order('created_at', { ascending: false })

          registrations = data || []
        }

        if (contentTypes.includes('todos')) {
          const { data } = await supabase
            .from('todos')
            .select('*')
            .eq('user_id', task.user_id)
            .eq('completed', false)
            .order('created_at', { ascending: false })

          todos = data || []
        }

        if (contentTypes.includes('notes')) {
          const { data } = await supabase
            .from('notes')
            .select('*')
            .eq('user_id', task.user_id)
            .gte('created_at', todayStr)
            .order('created_at', { ascending: false })

          notes = data || []
        }

        // 生成邮件内容
        const emailHtml = generateEmailHtml(
          profile.username || '用户',
          registrations,
          todos,
          notes
        )

        // 发送邮件
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.resend_api_key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${config.from_name} <${config.from_email}>`,
            to: [profile.email],
            subject: `${task.name} - ${now.toLocaleDateString('zh-CN')}`,
            html: emailHtml,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`发送邮件失败 (${task.name}):`, errorText)
          errors.push(`任务 ${task.name}: ${errorText}`)
          
          // 记录失败日志
          await supabase.from('email_send_logs').insert({
            notification_id: task.id,
            user_email: profile.email,
            status: 'failed',
            error_message: errorText,
          })
          
          continue
        }

        const result = await response.json()
        console.log(`邮件发送成功 (${task.name}), ID: ${result.id}`)
        sentCount++

        // 记录发送日志
        await supabase.from('email_send_logs').insert({
          notification_id: task.id,
          user_email: profile.email,
          status: 'success',
        })

      } catch (error: any) {
        console.error(`处理任务 ${task.name} 时出错:`, error)
        errors.push(`任务 ${task.name}: ${error.message}`)
        
        // 记录失败日志
        try {
          await supabase.from('email_send_logs').insert({
            notification_id: task.id,
            user_email: profile.email || 'unknown',
            status: 'failed',
            error_message: error.message,
          })
        } catch (logError) {
          console.error('记录日志失败:', logError)
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `成功发送 ${sentCount}/${tasksToSend.length} 封邮件`,
        sent: sentCount,
        total: tasksToSend.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

function generateEmailHtml(
  username: string,
  registrations: any[],
  todos: any[],
  notes: any[]
): string {
  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>每日报告</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      padding-bottom: 20px;
      border-bottom: 2px solid #4f46e5;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0;
      color: #4f46e5;
      font-size: 24px;
    }
    .header p {
      margin: 10px 0 0 0;
      color: #666;
      font-size: 14px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 18px;
      font-weight: bold;
      color: #4f46e5;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e5e7eb;
    }
    .empty-state {
      text-align: center;
      padding: 20px;
      color: #999;
      font-style: italic;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background-color: #f9fafb;
      font-weight: 600;
      color: #374151;
    }
    .todo-item {
      padding: 12px;
      background-color: #f9fafb;
      border-left: 3px solid #4f46e5;
      margin-bottom: 10px;
      border-radius: 4px;
    }
    .todo-title {
      font-weight: 600;
      color: #111827;
      margin-bottom: 4px;
    }
    .todo-desc {
      font-size: 14px;
      color: #6b7280;
    }
    .note-item {
      padding: 12px;
      background-color: #fffbeb;
      border-left: 3px solid #f59e0b;
      margin-bottom: 10px;
      border-radius: 4px;
    }
    .note-content {
      color: #374151;
      margin-bottom: 4px;
    }
    .note-time {
      font-size: 12px;
      color: #9ca3af;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 12px;
    }
    .summary {
      background-color: #f0f9ff;
      border-radius: 6px;
      padding: 15px;
      margin-bottom: 20px;
    }
    .summary-item {
      display: inline-block;
      margin-right: 20px;
      font-size: 14px;
    }
    .summary-label {
      color: #6b7280;
    }
    .summary-value {
      font-weight: bold;
      color: #4f46e5;
      font-size: 18px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 每日数据报告</h1>
      <p>${today}</p>
      <p>您好，${username}！</p>
    </div>

    <div class="summary">
      <div class="summary-item">
        <span class="summary-label">今日报名：</span>
        <span class="summary-value">${registrations.length}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">待办事项：</span>
        <span class="summary-value">${todos.length}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">今日备注：</span>
        <span class="summary-value">${notes.length}</span>
      </div>
    </div>

    ${registrations.length > 0 ? `
    <div class="section">
      <div class="section-title">📝 今日报名记录</div>
      <table>
        <thead>
          <tr>
            <th>活动名称</th>
            <th>人员</th>
            <th>联系方式</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          ${registrations.map(reg => `
            <tr>
              <td>${reg.activity?.name || '未知活动'}</td>
              <td>${reg.person?.name || '未知'}</td>
              <td>${reg.person?.phone || '-'}</td>
              <td>${reg.status === 'confirmed' ? '✅ 已确认' : reg.status === 'pending' ? '⏳ 待确认' : '❌ 已取消'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${todos.length > 0 ? `
    <div class="section">
      <div class="section-title">✅ 待办事项</div>
      ${todos.map(todo => `
        <div class="todo-item">
          <div class="todo-title">${todo.title}</div>
          ${todo.description ? `<div class="todo-desc">${todo.description}</div>` : ''}
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${notes.length > 0 ? `
    <div class="section">
      <div class="section-title">📌 今日备注</div>
      ${notes.map(note => `
        <div class="note-item">
          <div class="note-content">${note.content}</div>
          <div class="note-time">${new Date(note.created_at).toLocaleString('zh-CN')}</div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${registrations.length === 0 && todos.length === 0 && notes.length === 0 ? `
    <div class="empty-state">
      <p>今日暂无数据</p>
    </div>
    ` : ''}

    <div class="footer">
      <p>© ${new Date().getFullYear()} 活动与人员管理系统 | 自动发送，请勿回复</p>
    </div>
  </div>
</body>
</html>
  `
}
