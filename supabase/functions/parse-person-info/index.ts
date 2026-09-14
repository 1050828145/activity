import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: '请提供要解析的文本' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 获取API密钥
    const apiKey = Deno.env.get('INTEGRATIONS_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API密钥未配置' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 构建AI提取prompt
    const systemPrompt = `你是一个信息提取助手。请从用户输入的文本中智能提取人员信息。

重要规则：
1. 提取字段：姓名(name)、电话(phone)、年龄(age)、性别(gender)
2. 必填字段：姓名和电话（11位手机号），缺少任一字段则该记录无效
3. 可选字段：年龄和性别，没有则返回null
4. 年龄必须是纯数字（整数），不要包含"岁"等单位，如果无法确定年龄则返回null
5. 电话必须是11位手机号，以1开头

多行处理规则：
- 输入可能是多行文本，每行可能包含一个人的部分或全部信息
- 需要智能判断哪些行属于同一个人
- 如果连续几行没有重复的姓名或电话，可能是同一个人的信息分散在多行
- 例如：
  张三
  13800138000
  25岁
  男
  这4行应该识别为1个人

- 也可能每行是一个独立的人：
  张三 13800138000 25 男
  李四 13900139000 30 女
  这2行应该识别为2个人

返回格式：
[
  {"name": "张三", "phone": "13800138000", "age": 25, "gender": "男"},
  {"name": "李四", "phone": "13900139000", "age": null, "gender": null}
]

注意：
1. 只返回JSON数组，不要任何其他文字
2. age必须是数字类型或null，不要字符串
3. 智能合并属于同一个人的多行信息`;

    // 调用文心AI API
    const response = await fetch(
      'https://app-99gqsi7u251d-api-zYkZz8qovQ1L-gateway.appmiaoda.com/v2/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gateway-Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API错误:', errorText);
      return new Response(
        JSON.stringify({ error: 'AI识别失败，请稍后重试' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 读取流式响应
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data && data !== '[DONE]') {
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || '';
                fullContent += content;
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      }
    }

    // 解析AI返回的JSON
    let persons = [];
    try {
      // 尝试提取JSON数组
      const jsonMatch = fullContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        persons = JSON.parse(jsonMatch[0]);
      } else {
        // 如果没有找到JSON数组，尝试整体解析
        persons = JSON.parse(fullContent);
      }

      // 验证和过滤数据
      persons = persons.filter((person: any) => {
        // 必须有姓名和电话
        if (!person.name || !person.phone) {
          return false;
        }
        // 验证电话格式（11位数字）
        if (!/^1[3-9]\d{9}$/.test(String(person.phone))) {
          return false;
        }
        return true;
      });

      // 标准化数据
      persons = persons.map((person: any) => {
        // 清理和验证年龄
        let age: number | undefined = undefined;
        if (person.age !== null && person.age !== undefined) {
          // 如果是字符串，移除"岁"等文字
          let ageStr = String(person.age).replace(/[岁年]/g, '').trim();
          const ageNum = parseInt(ageStr);
          // 验证年龄范围（1-150）
          if (!isNaN(ageNum) && ageNum > 0 && ageNum < 150) {
            age = ageNum;
          }
        }

        return {
          name: String(person.name).trim(),
          contact: String(person.phone).trim(),
          age: age,
          gender: person.gender ? String(person.gender).trim() : undefined,
        };
      });
    } catch (e) {
      console.error('解析AI响应失败:', e, '原始内容:', fullContent);
      return new Response(
        JSON.stringify({ error: '无法识别有效的人员信息，请检查输入格式' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (persons.length === 0) {
      return new Response(
        JSON.stringify({ error: '未能识别出有效的人员信息（需要包含姓名和电话）' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ persons }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('处理请求失败:', error);
    return new Response(
      JSON.stringify({ error: '服务器错误' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
