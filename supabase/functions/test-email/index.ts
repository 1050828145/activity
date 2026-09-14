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

interface TestEmailRequest {
  to_email: string
  subject: string
  content: string
}

Deno.serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 获取环境变量
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // 获取 Authorization 请求头
    const authHeader = req.headers.get('Authorization')
    const apiKey = req.headers.get('apikey')

    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          error: '未授权访问：缺少身份验证请求头',
          debug: {
            hasApiKey: !!apiKey,
            headers: Array.from(req.headers.keys())
          }
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // 创建 Supabase 客户端 (使用 Service Role Key 以确保能读取配置，但仍需验证用户)
    const supabaseAdmin = createClient(
      supabaseUrl ?? '',
      supabaseServiceKey ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        }
      }
    )

    // 验证用户身份 - 使用传入的 JWT
    const jwt = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(jwt)

    if (authError || !user) {
      console.error('身份验证详细错误:', authError)
      return new Response(
        JSON.stringify({ 
          error: '未授权访问：用户身份验证失败', 
          details: authError?.message || '无法获取用户信息',
          code: authError?.status || 'unknown',
          debug: {
            jwtPrefix: jwt.substring(0, 10) + '...',
            jwtLength: jwt.length,
            authError: authError
          }
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // 获取请求数据
    const { to_email, subject, content }: TestEmailRequest = await req.json()

    const logs: string[] = []
    logs.push(`[${new Date().toISOString()}] 开始测试邮件发送`)
    logs.push(`收件人: ${to_email}`)
    logs.push(`主题: ${subject}`)

    // 获取邮件配置
    logs.push('正在获取邮件配置...')
    const { data: config, error: configError } = await supabaseAdmin
      .from('email_config')
      .select('*')
      .maybeSingle()

    if (configError) {
      logs.push(`❌ 获取邮件配置失败: ${configError.message}`)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: '获取邮件配置失败',
          logs 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!config) {
      logs.push('❌ 未找到邮件配置，请先配置SMTP服务器')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: '未找到邮件配置，请先配置SMTP服务器',
          logs 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    logs.push('✅ 邮箱配置获取成功')
    logs.push(`发件人: ${config.from_name} <${config.from_email}>`)

    // --- 开始采集真实数据 ---
    logs.push('正在采集今日数据...')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString()

    // 1. 采集今日报名情况
    const { data: registrations, error: regError } = await supabaseAdmin
      .from('activity_participants')
      .select(`
        id, 
        created_at,
        activities!activity_id (name),
        persons!person_id (name)
      `)
      .gte('created_at', todayStr)

    // 2. 采集今日待办 (新的报名)
    // 假设存在 pending_registrations 表，或者根据逻辑获取待办
    const { data: todos, error: todoError } = await supabaseAdmin
      .from('activity_participants')
      .select('id')
      .eq('status', '待确认') // 假设有这个状态

    // 3. 采集备注信息
    const { data: notes, error: notesError } = await supabaseAdmin
      .from('activities')
      .select('name, notes')
      .not('notes', 'is', null)
      .gte('updated_at', todayStr)

    logs.push(`✅ 数据采集完成: 报名(${registrations?.length || 0}), 待办(${todos?.length || 0}), 备注(${notes?.length || 0})`)

    // --- 构建正式格式的邮件内容 ---
    logs.push('正在渲染正式邮件模板...')
    
    let contentHtml = `
      <div style="margin-bottom: 20px;">
        <h2 style="color: #4f46e5; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">📊 今日数据摘要</h2>
        <p>报告生成时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
      </div>
    `

    // 报名情况部分
    if (registrations && registrations.length > 0) {
      contentHtml += `
        <div style="margin-bottom: 25px;">
          <h3 style="color: #1f2937;">📝 今日新增报名 (${registrations.length})</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
              <tr style="background-color: #f3f4f6; text-align: left;">
                <th style="padding: 10px; border: 1px solid #e5e7eb;">人员</th>
                <th style="padding: 10px; border: 1px solid #e5e7eb;">活动名称</th>
                <th style="padding: 10px; border: 1px solid #e5e7eb;">报名时间</th>
              </tr>
            </thead>
            <tbody>
              ${registrations.map(reg => `
                <tr>
                  <td style="padding: 10px; border: 1px solid #e5e7eb;">${(reg as any).persons?.name || '未知'}</td>
                  <td style="padding: 10px; border: 1px solid #e5e7eb;">${(reg as any).activities?.name || '未知'}</td>
                  <td style="padding: 10px; border: 1px solid #e5e7eb;">${new Date(reg.created_at).toLocaleTimeString('zh-CN')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `
    } else {
      contentHtml += `<p style="color: #6b7280; font-style: italic;">今日暂无新增报名数据。</p>`
    }

    // 待办事项部分
    contentHtml += `
      <div style="margin-bottom: 25px;">
        <h3 style="color: #1f2937;">🔔 当前待办事项</h3>
        <p>系统当前共有 <strong>${todos?.length || 0}</strong> 条待确认的报名信息需要处理。</p>
        ${todos && todos.length > 0 ? `<a href="${Deno.env.get('APP_URL')}/pending-registrations" style="color: #4f46e5; text-decoration: underline;">前往系统处理待办</a>` : ''}
      </div>
    `

    // 备注信息部分
    if (notes && notes.length > 0) {
      contentHtml += `
        <div style="margin-bottom: 25px;">
          <h3 style="color: #1f2937;">💡 相关备注/变动</h3>
          <ul style="padding-left: 20px;">
            ${notes.map(n => `
              <li style="margin-bottom: 8px;"><strong>${n.name}:</strong> ${n.notes}</li>
            `).join('')}
          </ul>
        </div>
      `
    }

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: sans-serif; line-height: 1.6; color: #374151; max-width: 700px; margin: 0 auto; padding: 20px; }
    .header { background: #4f46e5; color: white; padding: 25px; border-radius: 8px 8px 0 0; text-align: center; }
    .main-content { border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px; background: #ffffff; }
    .footer { text-align: center; margin-top: 25px; color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 24px;">📬 系统通知报告</h1>
    <p style="margin: 10px 0 0; opacity: 0.9;">活动与人员管理系统</p>
  </div>
  <div class="main-content">
    ${contentHtml}
  </div>
  <div class="footer">
    <p>这是一封由系统自动生成的定时报告测试邮件</p>
    <p>© ${new Date().getFullYear()} 活动与人员管理系统 | 官方报告</p>
  </div>
</body>
</html>
    `

    logs.push('✅ 邮件内容构建完成 (包含真实业务数据)')
    
    // --- 正式发送逻辑开始 (Resend HTTP API 模式) ---
    logs.push('正在准备执行正式发送流程 (基于 Resend HTTP API)...')
    
    try {
      // 使用数据库中配置的 API Key
      const resendApiKey = config.resend_api_key
      if (!resendApiKey) {
        logs.push('❌ 错误: 邮箱配置中未设置 Resend API Key')
        logs.push('💡 提示: 请在"邮箱配置"中填写 Resend API Key。')
        throw new Error('缺少 Resend API Key')
      }

      logs.push(`正在连接 Resend API 终端点...`)
      
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${config.from_name} <${config.from_email}>`,
          to: [to_email],
          subject: subject,
          html: emailHtml,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logs.push(`❌ 发送过程中出错: ${errorText}`)
        throw new Error(errorText)
      }

      const result = await response.json()
      logs.push(`✅ 邮件已成功投递至 Resend 系统，任务 ID: ${result.id}`)
      logs.push('✅ 状态: 投递成功')

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: '邮件发送成功！请检查收件箱（包括垃圾箱）。',
          logs,
          preview: {
            subject,
            to: to_email,
            from: `${config.from_name} <${config.from_email}>`,
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )

    } catch (sendError: any) {
      const errorMsg = sendError.message || String(sendError)
      logs.push(`❌ 发送过程中出错: ${errorMsg}`)
      
      // 提供针对常见错误的友好提示
      if (errorMsg.includes('Unauthorized') || errorMsg.includes('401')) {
        logs.push('💡 提示: API Key 身份验证失败，请检查 RESEND_API_KEY 是否正确。')
      } else if (errorMsg.includes('not verified')) {
        logs.push('💡 提示: 发件人邮箱未在 Resend 后台验证。')
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: '邮件发送失败',
          details: errorMsg,
          logs 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
  } catch (error: any) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        logs: [`❌ 发生大错误: ${error.message}`]
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
