import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import IntersectObserver from '@/components/common/IntersectObserver';
import RouteGuard from '@/components/common/RouteGuard';
import { AuthProvider } from '@/context/AuthContext';
import MainLayout from '@/components/layouts/MainLayout';
import MobileLayout from '@/components/layouts/MobileLayout';
import MobileActivityRegister from '@/pages/mobile/MobileActivityRegister';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import { Toaster } from 'sonner';
import { startTaskScheduler, stopTaskScheduler } from '@/services/TaskScheduler';

import routes from './routes';

function AppContent() {
  const location = useLocation();
  const isMobilePath = location.pathname.startsWith('/mobile');
  const isRegisterPath = location.pathname.includes('/activity') && location.pathname.includes('/register');
  const isAuthPath = location.pathname === '/login' || location.pathname === '/register';

  // 报名页面不使用任何Layout，完全独立
  if (isRegisterPath) {
    return (
      <>
        <IntersectObserver />
        <Routes>
          <Route path="/mobile/activity/:id/register" element={<MobileActivityRegister />} />
          {routes.map((route, index) => (
            <Route
              key={index}
              path={route.path}
              element={route.element}
            />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-right" />
      </>
    );
  }

  // 登录注册页面不使用Layout
  if (isAuthPath) {
    return (
      <>
        <IntersectObserver />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          {routes.map((route, index) => (
            <Route
              key={index}
              path={route.path}
              element={route.element}
            />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-right" />
      </>
    );
  }

  const Layout = isMobilePath ? MobileLayout : MainLayout;

  return (
    <>
      <IntersectObserver />
      <Layout>
        <Routes>
          {routes.map((route, index) => (
            <Route
              key={index}
              path={route.path}
              element={route.element}
            />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <Toaster />
    </>
  );
}

const App: React.FC = () => {
  // 启动任务调度器
  useEffect(() => {
    console.log('[App] 启动任务调度器');
    startTaskScheduler();

    // 清理函数：组件卸载时停止调度器
    return () => {
      console.log('[App] 停止任务调度器');
      stopTaskScheduler();
    };
  }, []);

  return (
    <Router>
      <AuthProvider>
        <RouteGuard>
          <AppContent />
        </RouteGuard>
      </AuthProvider>
    </Router>
  );
};

export default App;
