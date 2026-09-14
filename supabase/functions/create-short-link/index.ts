import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(
        JSON.stringify({ error: '缺少 url 参数' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 先查数据库缓存，避免重复生成
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: cached } = await supabase
      .from('short_links')
      .select('short_url')
      .eq('original_url', url)
      .maybeSingle();

    if (cached?.short_url) {
      return new Response(
        JSON.stringify({ short_url: cached.short_url }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 调用 TinyURL API 生成短链接
    const tinyRes = await fetch(
      `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );

    if (!tinyRes.ok) {
      throw new Error(`TinyURL 请求失败: ${tinyRes.status}`);
    }

    const shortUrl = (await tinyRes.text()).trim();

    if (!shortUrl.startsWith('https://tinyurl.com/')) {
      throw new Error('TinyURL 返回格式异常');
    }

    // 写入缓存
    await supabase.from('short_links').insert({
      original_url: url,
      short_url: shortUrl,
    });

    return new Response(
      JSON.stringify({ short_url: shortUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('生成短链接失败:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
