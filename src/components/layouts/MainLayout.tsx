import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Calendar, Users, Menu, UserCheck, ClipboardList, Home, Bell, ChevronDown, ChevronRight, LogOut, User, Settings, PanelLeftClose, PanelLeft, KeyRound, X, ChevronLeft, BarChart3, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useEffect, useMemo } from 'react';
import { getPendingRegistrationsCount, updateUserPassword } from '@/db/api';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { useAutoBackup } from '@/hooks/use-auto-backup';
import routes from '@/routes';
import { matchPath } from 'react-router-dom';


interface NavigationItem {
  name: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavigationItem[];
  adminOnly?: boolean;
}

const navigation: NavigationItem[] = [
  { name: '主页', href: '/', icon: Home },
  { name: '仪表盘', href: '/dashboard', icon: LayoutDashboard },
  {
    name: '待办',
    icon: Bell,
    children: [
      { name: '新的报名', href: '/pending-registrations', icon: Bell },
    ],
  },
  { name: '活动管理', href: '/activities', icon: Calendar },
  { name: '人员管理', href: '/persons', icon: Users },
  { name: '领队管理', href: '/leaders', icon: UserCheck },
  { name: '参与人员', href: '/participations', icon: ClipboardList },
  {
    name: '推广任务',
    icon: ClipboardList,
    children: [
      { name: '每日任务', href: '/promotion/daily-tasks', icon: ClipboardList },
      { name: '任务设置', href: '/promotion/task-settings', icon: Settings },
      { name: '推广记录', href: '/promotion/records', icon: ClipboardList },
    ],
  },
  {
    name: '统计分析',
    icon: BarChart3,
    children: [
      { name: '新增参与人员统计', href: '/analytics/daily-participants', icon: ClipboardList },
      { name: '领队招募情况分析', href: '/analytics/leader-recruitment', icon: BarChart3 },
      { name: '推广转化周报', href: '/promotion/weekly-report', icon: BarChart3 },
    ],
  },
  {
    name: '数据产品',
    icon: ClipboardList,
    children: [
      { name: '活动和参与人员清单', href: '/data-products/activity-participants-list', icon: ClipboardList },
    ],
  },
  {
    name: '信息通知',
    icon: Bell,
    children: [
      { name: '邮箱通知', href: '/notifications/email', icon: Bell },
    ],
  },
  { name: '定时任务', href: '/scheduled-tasks', icon: Settings, adminOnly: true },
  {
    name: '系统',
    icon: Settings,
    children: [
      { name: '活动类型管理', href: '/activity-types', icon: Tag },
      { name: '用户管理', href: '/system/users', icon: Users, adminOnly: true },
      { name: '列表配置', href: '/system/table-configs', icon: Settings, adminOnly: true },
      { name: '数据备份', href: '/system/backup', icon: Settings },
    ],
  },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set(['待办', '系统']));
  const [pendingCount, setPendingCount] = useState<number>(0);
  const { profile, signOut } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // 页面缓存池
  const [pageCache, setPageCache] = useState<Record<string, React.ReactNode>>({});
  
  // 历史记录管理
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  // 自动数据备份
  useAutoBackup();

  // 更新页面缓存
  useEffect(() => {
    // 忽略一些不应该缓存的路径
    if (location.pathname === '/login' || location.pathname === '/register') return;
    
    setPageCache(prev => {
      // 如果已经缓存过且引用没变，不更新（避免不必要的渲染）
      if (prev[location.pathname] === children) return prev;
      return {
        ...prev,
        [location.pathname]: children
      };
    });
  }, [location.pathname, children]);

  // 监听浏览器历史记录变化，更新前进后退按钮状态
  useEffect(() => {
    const updateNavigationState = () => {
      // 简单判断：如果不是初始页面，就可以后退
      setCanGoBack(window.history.length > 1);
      // 前进按钮的状态较难判断，这里暂时设为false
      // 实际使用中，只有在用户点击后退后，才能前进
      setCanGoForward(false);
    };

    updateNavigationState();
    
    // 监听 popstate 事件（浏览器前进后退）
    window.addEventListener('popstate', updateNavigationState);
    
    return () => {
      window.removeEventListener('popstate', updateNavigationState);
    };
  }, [location]);

  const handleGoBack = () => {
    if (canGoBack) {
      navigate(-1);
      setCanGoForward(true); // 后退后就可以前进了
    }
  };

  const handleGoForward = () => {
    if (canGoForward) {
      navigate(1);
    }
  };

  // 修改密码对话框状态
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isChanging, setIsChanging] = useState(false);

  // 处理修改密码
  const handleChangePassword = async () => {
    if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error('请填写完整信息');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('两次输入的新密码不一致');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error('新密码长度不能少于6位');
      return;
    }

    setIsChanging(true);
    try {
      // 在 Supabase 中，updateUser 只需要新密码。
      // 但为了符合用户“输入之前密码”的要求，这里可以增加一个验证旧密码的逻辑。
      // 注意：Supabase JS SDK 并没有直接验证旧密码而不登录的方法。
      // 我们可以尝试用旧密码重新登录一次来验证。
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile?.email || '',
        password: passwordForm.oldPassword,
      });

      if (signInError) {
        throw new Error('旧密码错误');
      }

      await updateUserPassword(passwordForm.newPassword);
      toast.success('密码修改成功');
      setShowPasswordDialog(false);
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error(error.message || '修改失败');
    } finally {
      setIsChanging(false);
    }
  };

  // 面包屑逻辑
  const getBreadcrumbs = () => {
    const crumbs: { name: string; href?: string }[] = [{ name: '首页', href: '/' }];
    
    // 优先从 navigation 查找
    let found = false;
    for (const item of navigation) {
      if (item.href === location.pathname) {
        if (item.href !== '/') crumbs.push({ name: item.name });
        found = true;
        break;
      }
      if (item.children) {
        const child = item.children.find(c => c.href === location.pathname);
        if (child) {
          crumbs.push({ name: item.name });
          crumbs.push({ name: child.name });
          found = true;
          break;
        }
      }
    }

    // 如果没找到，从 routes 查找（处理详情页等）
    if (!found) {
      for (const route of routes) {
        const match = matchPath(route.path, location.pathname);
        if (match) {
          // 尝试找到父级（如果有约定的层级，目前简单处理）
          if (route.path.includes('/:id')) {
             const parentPath = route.path.split('/:id')[0];
             const parentRoute = routes.find(r => r.path === parentPath);
             if (parentRoute) crumbs.push({ name: parentRoute.name, href: parentPath });
          }
          crumbs.push({ name: route.name });
          break;
        }
      }
    }
    return crumbs;
  };

  // 获取待办数量
  useEffect(() => {
    const loadPendingCount = async () => {
      if (!profile) return; // 只有登录后才加载待办数量
      try {
        const count = await getPendingRegistrationsCount();
        setPendingCount(count);
      } catch (error) {
        console.error('获取待办数量失败:', error);
      }
    };

    loadPendingCount();

    // 每30秒刷新一次待办数量
    const interval = setInterval(loadPendingCount, 30000);
    return () => clearInterval(interval);
  }, [profile]);

  // 监听路由变化，从待办页面返回时刷新数量
  useEffect(() => {
    const loadPendingCount = async () => {
      if (!profile) return; // 只有登录后才加载待办数量
      try {
        const count = await getPendingRegistrationsCount();
        setPendingCount(count);
      } catch (error) {
        console.error('获取待办数量失败:', error);
      }
    };

    // 当路由变化时刷新待办数量
    loadPendingCount();
  }, [location.pathname, profile]);

  const toggleMenu = (menuName: string) => {
    setExpandedMenus(prev => {
      const newSet = new Set(prev);
      if (newSet.has(menuName)) {
        newSet.delete(menuName);
      } else {
        newSet.add(menuName);
      }
      return newSet;
    });
  };

  const isMenuActive = (item: NavigationItem): boolean => {
    if (item.href && location.pathname === item.href) return true;
    if (item.children) {
      return item.children.some(child => child.href === location.pathname);
    }
    return false;
  };

  const NavLinks = () => {
    const { profile } = useAuth();
    const isAdmin = profile?.role === 'admin';
    const isAuthenticated = !!profile;

    const filteredNavigation = navigation
      .filter(item => {
        // 未登录时，只显示主页
        if (!isAuthenticated) return item.name === '主页';
        // 管理员权限过滤
        if (item.adminOnly && !isAdmin) return false;
        return true;
      })
      .map(item => {
        if (!item.children) return item;
        // 对子菜单进行过滤
        const filteredChildren = item.children.filter(child => {
          if (child.adminOnly && !isAdmin) return false;
          return true;
        });
        return { ...item, children: filteredChildren.length > 0 ? filteredChildren : undefined };
      });

    return (
      <>
        {filteredNavigation.map((item) => {
        const isActive = isMenuActive(item);
        const isExpanded = expandedMenus.has(item.name);

        // 有子菜单的项
        if (item.children) {
          return (
            <div key={item.name}>
              <button
                onClick={() => toggleMenu(item.name)}
                className={cn(
                  'w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-5 w-5" />
                  {!isCollapsed && <span>{item.name}</span>}
                </div>
                {!isCollapsed && (
                  <div className="flex items-center gap-2">
                    {item.name === '待办' && pendingCount > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="h-4 min-w-[16px] flex items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none"
                      >
                        {pendingCount}
                      </Badge>
                    )}
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </div>
                )}
              </button>
              {isExpanded && !isCollapsed && (
                <div className="ml-4 mt-1 space-y-1">
                  {item.children.map((child) => {
                    const isChildActive = location.pathname === child.href;
                    return (
                      <Link
                        key={child.name}
                        to={child.href!}
                        onClick={() => setOpen(false)}
                        className={cn(
                          'flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          isChildActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <child.icon className="h-4 w-4" />
                          {child.name}
                        </div>
                        {child.name === '新的报名' && pendingCount > 0 && (
                          <Badge 
                            variant="destructive" 
                            className="h-4 min-w-[16px] flex items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none"
                          >
                            {pendingCount}
                          </Badge>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        // 没有子菜单的项
        return (
          <Link
            key={item.name}
            to={item.href!}
            onClick={() => setOpen(false)}
            title={isCollapsed ? item.name : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              isCollapsed && 'justify-center px-0'
            )}
          >
            <item.icon className="h-5 w-5" />
            {!isCollapsed && <span>{item.name}</span>}
          </Link>
        );
      })}
      </>
    );
  };

  return (
    <div className="flex min-h-screen w-full bg-background overflow-hidden">
      {/* 修改密码对话框 */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>修改密码</DialogTitle>
            <DialogDescription>
              请输入您的旧密码并设置新密码。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="old">旧密码</Label>
              <Input
                id="old"
                type="password"
                value={passwordForm.oldPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new">新密码</Label>
              <Input
                id="new"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm">确认新密码</Label>
              <Input
                id="confirm"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              取消
            </Button>
            <Button onClick={handleChangePassword} disabled={isChanging}>
              {isChanging ? '提交中...' : '提交'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 桌面侧边栏 */}
      <aside 
        className={cn(
          "hidden lg:flex flex-col border-r border-border bg-card shrink-0 sticky top-0 h-screen overflow-y-auto transition-all duration-300",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex h-16 items-center border-b border-border px-4 justify-between">
          {!isCollapsed && <h1 className="text-xl font-bold text-foreground truncate">活动人员管理</h1>}
          <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)}>
            {isCollapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </Button>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <NavLinks />
        </nav>
        {/* 用户信息区域 */}
        <div className="border-t border-border p-3">
          {profile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className={cn("w-full justify-start gap-3", isCollapsed && "px-0 justify-center")}>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {profile?.username?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 text-left truncate">
                      <p className="text-sm font-medium">{profile?.username || '用户'}</p>
                      <p className="text-xs text-muted-foreground">
                        {profile?.role === 'admin' ? '管理员' : '普通用户'}
                      </p>
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>我的账号</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/user-center')}>
                  <User className="mr-2 h-4 w-4" />
                  <span>用户中心</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
                  setShowPasswordDialog(true);
                }}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  <span>修改密码</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>退出登录</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button 
              variant="default" 
              className={cn("w-full gap-2", isCollapsed && "px-0 justify-center")}
              onClick={() => navigate('/login')}
            >
              <LogOut className="h-4 w-4 rotate-180" />
              {!isCollapsed && <span>登录系统</span>}
            </Button>
          )}
        </div>
      </aside>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* 固定顶部栏 */}
        <header className="sticky top-0 z-20 flex h-24 flex-col border-b border-border bg-card">
          {/* 顶部标题与面包屑 */}
          <div className="flex h-12 items-center justify-between border-b border-border px-4">
            <div className="flex items-center gap-4">
              {/* 移动端菜单按钮 */}
              <div className="lg:hidden">
                <Sheet open={open} onOpenChange={setOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-64 p-0">
                    <div className="flex h-full flex-col">
                      <div className="flex h-16 items-center border-b border-border px-6">
                        <h1 className="text-xl font-bold text-foreground">活动人员管理</h1>
                      </div>
                      <nav className="flex-1 space-y-1 p-4">
                        <NavLinks />
                      </nav>
                      <div className="border-t border-border p-4 space-y-2">
                        {profile ? (
                          <>
                            <div className="flex items-center gap-3 px-2 py-1">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary text-primary-foreground">
                                  {profile?.username?.charAt(0).toUpperCase() || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">{profile?.username}</p>
                                <p className="text-xs text-muted-foreground">{profile?.role === 'admin' ? '管理员' : '普通用户'}</p>
                              </div>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full justify-start" 
                              onClick={() => {
                                navigate('/user-center');
                                setOpen(false);
                              }}
                            >
                              <User className="mr-2 h-4 w-4" />
                              用户中心
                            </Button>
                            <Button variant="outline" size="sm" className="w-full justify-start" onClick={signOut}>
                              <LogOut className="mr-2 h-4 w-4" />
                              退出登录
                            </Button>
                          </>
                        ) : (
                          <Button variant="default" className="w-full gap-2" onClick={() => navigate('/login')}>
                            <LogOut className="h-4 w-4 rotate-180" />
                            登录系统
                          </Button>
                        )}
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
              
              {/* 面包屑 */}
              <nav className="hidden md:flex items-center text-sm text-muted-foreground">
                {getBreadcrumbs().map((crumb, idx, arr) => (
                  <div key={idx} className="flex items-center">
                    {crumb.href ? (
                      <Link to={crumb.href} className="hover:text-foreground transition-colors">
                        {crumb.name}
                      </Link>
                    ) : (
                      <span className="text-foreground font-medium">{crumb.name}</span>
                    )}
                    {idx < arr.length - 1 && <ChevronRight className="h-4 w-4 mx-2" />}
                  </div>
                ))}
              </nav>
            </div>
            <div className="lg:hidden text-lg font-semibold text-foreground">活动人员管理</div>
          </div>

        </header>

        {/* 页面内容 */}
        <main className="flex-1 relative bg-background overflow-hidden">
          {Object.entries(pageCache).map(([path, element]) => (
            <div
              key={path}
              className={cn(
                "w-full h-full overflow-y-auto p-4 md:p-6 lg:p-8 bg-background",
                location.pathname === path ? "block" : "hidden"
              )}
            >
              {element}
            </div>
          ))}
          {/* 如果当前页面还没加载到缓存中，临时显示 children */}
          {!pageCache[location.pathname] && (
            <div className="w-full h-full overflow-y-auto p-4 md:p-6 lg:p-8 bg-background">
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
