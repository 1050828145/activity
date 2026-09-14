import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, User, Phone, Eye, CheckCircle2 } from 'lucide-react';
import { getPendingRegistrations, markRegistrationAsViewed, markRegistrationsAsViewed } from '@/db/api';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import { useAuthCheck } from '@/hooks/use-auth-check';

interface PendingRegistration {
  id: string;
  activity_id: string;
  person_id: string;
  status: string;
  created_at: string;
  activities?: {
    id: string;
    name: string;
    start_date: string;
    location: string;
    status: string;
  };
  persons?: {
    id: string;
    name: string;
    contact: string;
    gender?: string;
    age?: number;
  };
}

const statusColors: Record<string, string> = {
  '待确认': 'bg-muted',
  '已确认': 'bg-primary',
  '进行中': 'bg-chart-1',
  '已完成': 'bg-chart-2',
  '已取消': 'bg-destructive',
};

export default function PendingRegistrations() {
  const { checkAuth } = useAuthCheck();
  const [registrations, setRegistrations] = useState<PendingRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadRegistrations();
  }, []);

  const loadRegistrations = async () => {
    try {
      setLoading(true);
      const data = await getPendingRegistrations();
      setRegistrations(data);
    } catch (error) {
      console.error('加载待办报名失败:', error);
      toast.error('加载待办报名失败');
    } finally {
      setLoading(false);
    }
  };

  // 当报名卡片进入视口时标记为已查看
  const handleCardView = async (registrationId: string) => {
    if (viewedIds.has(registrationId)) return;
    if (!checkAuth('处理报名')) return;

    try {
      await markRegistrationAsViewed(registrationId);
      setViewedIds(prev => new Set(prev).add(registrationId));
      
      // 从列表中移除已查看的报名
      setRegistrations(prev => prev.filter(r => r.id !== registrationId));
      
      toast.success('报名已查看');
    } catch (error) {
      console.error('标记已查看失败:', error);
      toast.error('标记已查看失败');
    }
  };

  // 标记全部为已查看
  const handleMarkAllAsViewed = async () => {
    if (registrations.length === 0) return;
    if (!checkAuth('批量处理报名')) return;

    try {
      const ids = registrations.map(r => r.id);
      await markRegistrationsAsViewed(ids);
      setRegistrations([]);
      toast.success('已标记全部为已查看');
    } catch (error) {
      console.error('批量标记失败:', error);
      toast.error('批量标记失败');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">新的报名</h1>
          <p className="text-muted-foreground mt-2">
            通过二维码提交的报名信息，查看后自动移除
          </p>
        </div>
        {registrations.length > 0 && (
          <Button onClick={handleMarkAllAsViewed} variant="outline">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            全部标记为已查看
          </Button>
        )}
      </div>

      {registrations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-xl font-medium text-muted-foreground">暂无新的报名</p>
            <p className="text-sm text-muted-foreground mt-2">
              所有报名都已查看
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {registrations.map((registration) => (
            <Card
              key={registration.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleCardView(registration.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg line-clamp-1">
                    {registration.activities?.name || '未知活动'}
                  </CardTitle>
                  <Badge className={statusColors[registration.activities?.status || '待确认']}>
                    {registration.activities?.status || '待确认'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {registration.activities?.start_date
                      ? formatDate(registration.activities.start_date)
                      : '未设置日期'}
                  </span>
                </div>

                <div className="flex items-center text-sm text-muted-foreground">
                  <MapPin className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {registration.activities?.location || '未设置地点'}
                  </span>
                </div>

                <div className="border-t pt-3 mt-3">
                  <div className="flex items-center text-sm mb-2">
                    <User className="mr-2 h-4 w-4 shrink-0 text-primary" />
                    <span className="font-medium">{registration.persons?.name || '未知'}</span>
                    {registration.persons?.gender && (
                      <Badge variant="outline" className="ml-2">
                        {registration.persons.gender}
                      </Badge>
                    )}
                    {registration.persons?.age && (
                      <Badge variant="outline" className="ml-2">
                        {registration.persons.age}岁
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center text-sm text-muted-foreground">
                    <Phone className="mr-2 h-4 w-4 shrink-0" />
                    <span>{registration.persons?.contact || '未提供'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-muted-foreground">
                    报名时间: {formatDate(registration.created_at)}
                  </span>
                  <Button size="sm" variant="ghost" className="h-7 text-xs">
                    <Eye className="mr-1 h-3 w-3" />
                    查看
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
