import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';

// 公开路由白名单（不需要登录即可访问）
const PUBLIC_ROUTES = [
  '/',                // 主页导航
  '/login',           // 登录页
  '/register',        // 注册页
];

// 公开路由正则表达式（用于匹配动态路径）
const PUBLIC_ROUTE_PATTERNS = [
  /^\/mobile\/activity\/[^/]+\/register$/, // 活动报名页 (手机端)
];

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    // 检查当前路由是否在白名单中
    const isPublicRoute = PUBLIC_ROUTES.includes(location.pathname) || 
                         PUBLIC_ROUTE_PATTERNS.some(pattern => pattern.test(location.pathname));

    // 如果未登录且进入非公开路由，重定向到登录页
    if (!user && !isPublicRoute) {
      console.log(`未登录访问受限路径: ${location.pathname}，正在重定向...`);
      navigate('/login', { 
        replace: true,
        state: { from: location.pathname }
      });
    }

    // 如果已登录且在登录/注册页，重定向到首页
    if (user && (location.pathname === '/login' || location.pathname === '/register')) {
      const from = (location.state as any)?.from || '/';
      navigate(from, { replace: true });
    }
  }, [user, loading, location, navigate]);

  // 加载中显示骨架屏
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-full max-w-md p-6">
          <Skeleton className="h-12 w-full bg-muted" />
          <Skeleton className="h-64 w-full bg-muted" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
