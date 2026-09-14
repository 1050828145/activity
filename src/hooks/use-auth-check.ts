import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { userFriendlyMessages } from '@/lib/user-friendly-messages';

/**
 * 自定义 Hook：检查用户是否已登录
 * 如果未登录，显示提示并跳转到登录页
 * @returns 返回一个函数，调用时检查登录状态
 */
export function useAuthCheck() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const checkAuth = (action: string = '执行此操作'): boolean => {
    if (!user) {
      toast.error(`${userFriendlyMessages.auth.notLoggedIn}\n\n您需要先登录才能${action}。`);
      navigate('/login', { state: { from: window.location.pathname } });
      return false;
    }
    return true;
  };

  return { checkAuth, isAuthenticated: !!user };
}
