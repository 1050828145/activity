import { Link } from 'react-router';
import { ArrowLeft, Calendar, Users, ClipboardList, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function MobileHome() {
  const quickActions = [
    {
      id: '1',
      title: '活动管理',
      description: '快速创建和管理活动',
      icon: Calendar,
      href: '/mobile/activities',
      color: 'bg-blue-500',
    },
    {
      id: '2',
      title: '人员管理',
      description: '添加和编辑人员信息',
      icon: Users,
      href: '/mobile/persons',
      color: 'bg-green-500',
    },
    {
      id: '3',
      title: '参与记录',
      description: '管理活动参与情况',
      icon: ClipboardList,
      href: '/mobile/participations',
      color: 'bg-purple-500',
    },
    {
      id: '4',
      title: '返回桌面版',
      description: '查看完整功能',
      icon: BarChart3,
      href: '/',
      color: 'bg-orange-500',
    },
  ];

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">移动端管理</h1>
          <p className="text-sm text-muted-foreground mt-1">快速管理活动和人员</p>
        </div>
        <Link to="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
      </div>

      {/* 快捷操作卡片 */}
      <div className="grid grid-cols-2 gap-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.id} to={action.href}>
              <Card className="hover:shadow-lg transition-shadow h-full">
                <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
                  <div className={cn('p-4 rounded-full', action.color)}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{action.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* 使用提示 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">使用说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>• 移动端界面专为手机操作优化，支持快速录入和修改</p>
          <p>• 支持批量创建和编辑活动、人员及参与记录</p>
          <p>• 适合现场使用，操作简单快捷</p>
          <p>• 如需查看详细统计和导出数据，请使用桌面版</p>
        </CardContent>
      </Card>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
