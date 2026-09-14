import { corsHeaders } from '../_shared/cors.ts';

const AI_API_URL = 'https://app-99gqsi7u251d-api-zYkZz8qovQ1L-gateway.appmiaoda.com/v2/chat/completions';

Deno.serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { activityInfo } = await req.json();

    if (!activityInfo) {
      return new Response(
        JSON.stringify({ error: '缺少活动信息' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 获取集成密钥
    const apiKey = Deno.env.get('INTEGRATIONS_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API密钥未配置' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 构建提示词
    const prompt = `请根据以下活动信息生成一段简洁的活动概要(50-100字):

活动名称: ${activityInfo.name || ''}
活动日期: ${activityInfo.date || ''}
活动地点: ${activityInfo.location || ''}
活动内容: ${activityInfo.content || ''}
需求人数: ${activityInfo.required_people || ''}人
人员要求: ${activityInfo.requirements || ''}

请直接输出活动概要,不要包含其他说明文字。`;

    // 调用文心大模型API
    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gateway-Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: '你是一个专业的活动概要生成助手,擅长提炼活动核心信息。' },
          { role: 'user', content: prompt }
        ],
        stream: true
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API错误:', errorText);
      return new Response(
        JSON.stringify({ error: 'AI生成失败' }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 返回流式响应
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('生成活动概要失败:', error);
    return new Response(
      JSON.stringify({ error: error.message || '生成失败' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
