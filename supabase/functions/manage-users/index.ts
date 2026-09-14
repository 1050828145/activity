import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 获取授权令牌并验证请求者是否为管理员
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("未经授权");
    }

    // 检查是否具有 admin 角色
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile.role !== "admin") {
      throw new Error("无管理员权限");
    }

    // 获取请求正文
    const { action, payload } = await req.json();

    let result;
    switch (action) {
      case "create": {
        const { username, password, email } = payload;
        // 使用模拟邮箱：username@miaoda.com
        const authEmail = email || `${username}@miaoda.com`;
        
        const { data, error } = await supabase.auth.admin.createUser({
          email: authEmail,
          password: password,
          email_confirm: true,
          user_metadata: { username, email },
        });

        if (error) throw error;
        result = data;
        break;
      }
      case "resetPassword": {
        const { userId, newPassword } = payload;
        const { data, error } = await supabase.auth.admin.updateUserById(userId, {
          password: newPassword,
        });

        if (error) throw error;
        result = data;
        break;
      }
      case "delete": {
        const { userId } = payload;
        const { error } = await supabase.auth.admin.deleteUser(userId);

        if (error) throw error;
        result = { success: true };
        break;
      }
      case "updateProfile": {
        const { userId, updates } = payload;
        const { data, error } = await supabase
          .from("profiles")
          .update(updates)
          .eq("id", userId)
          .select()
          .single();

        if (error) throw error;
        result = data;
        break;
      }
      default:
        throw new Error("未知操作类型");
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
