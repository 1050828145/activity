import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';

interface Profile {
  id: string;
  username: string;
  email: string | null;
  role: 'user' | 'admin';
  auto_backup: boolean;
  last_login_at?: string;
  last_login_ip?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string, email?: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  isAdmin: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // 获取用户资料
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle<Profile>();

      if (error) throw error;
      setProfile(data);

      // 自动备份逻辑：如果开启了自动备份且本次会话尚未执行
      if (data?.auto_backup && !sessionStorage.getItem('miaoda_auto_backup_done')) {
        try {
          // 调用新的备份 API
          const { backupDatabase } = await import('@/db/api');
          const result = await backupDatabase();
          
          // 触发下载
          const blob = new Blob([result.sql], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = result.filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          sessionStorage.setItem('miaoda_auto_backup_done', 'true');
          toast.success(`数据备份成功！已备份 ${result.tableCount} 个表结构，${result.dataTableCount} 个表数据`);
          console.log('登录自动备份已完成');
        } catch (backupError) {
          console.error('自动备份执行失败:', backupError);
          toast.error('自动备份失败，请稍后手动备份');
        }
      }
    } catch (error) {
      console.error('获取用户资料失败:', error);
    }
  };

  // 初始化认证状态
  useEffect(() => {
    // 获取当前会话
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // 监听认证状态变化
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 登录（使用用户名模拟邮箱）
  const signIn = async (username: string, password: string) => {
    try {
      const email = `${username}@miaoda.com`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // 尝试获取 IP
        let ip = 'Unknown';
        try {
          const res = await fetch('https://api.ipify.org?format=json');
          if (res.ok) {
            const json = await res.json();
            ip = json.ip;
          }
        } catch (e) {
          console.error('获取IP失败:', e);
        }

        // 更新登录记录
        const profilesTable: any = supabase.from('profiles');
        await profilesTable.update({
          last_login_at: new Date().toISOString(),
          last_login_ip: ip
        }).eq('id', data.user.id);

        await fetchProfile(data.user.id);
        toast.success('登录成功');
      }
    } catch (error: any) {
      console.error('登录失败:', error);
      toast.error(error.message || '登录失败，请检查用户名和密码');
      throw error;
    }
  };

  // 注册（使用用户名模拟邮箱）
  const signUp = async (username: string, password: string, email?: string) => {
    try {
      // 验证用户名格式（只允许字母、数字和下划线）
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        throw new Error('用户名只能包含字母、数字和下划线');
      }

      const authEmail = `${username}@miaoda.com`;
      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password,
        options: {
          data: {
            username,
            email: email || null,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        // 由于禁用了邮箱验证，用户会立即确认
        // 触发器会自动创建 profile 记录
        await fetchProfile(data.user.id);
        toast.success('注册成功');
      }
    } catch (error: any) {
      console.error('注册失败:', error);
      toast.error(error.message || '注册失败');
      throw error;
    }
  };

  // 登出
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setProfile(null);
      toast.success('已退出登录');
    } catch (error: any) {
      console.error('登出失败:', error);
      toast.error(error.message || '登出失败');
      throw error;
    }
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  return context;
}
