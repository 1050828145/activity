import { Link, useLocation } from 'react-router';
import { cn } from '@/lib/utils';
import { Calendar, Users, ClipboardList, Home } from 'lucide-react';

const navigation = [
  { name: '主页', href: '/mobile', icon: Home },
  { name: '活动', href: '/mobile/activities', icon: Calendar },
  { name: '人员', href: '/mobile/persons', icon: Users },
  { name: '参与', href: '/mobile/participations', icon: ClipboardList },
];

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* 主内容区域 */}
      <main className="flex-1 overflow-y-auto pb-16">
        {children}
      </main>

      {/* 底部导航栏 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
        <div className="flex justify-around items-center h-16">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
