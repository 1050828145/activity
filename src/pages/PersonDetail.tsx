import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Phone, User, Calendar, IdCard, Briefcase, Ruler, Weight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { getPerson, getPersonActivities } from '@/db/api';
import type { Person, Activity } from '@/types';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

const statusColors: Record<string, string> = {
  '待确认': 'bg-muted text-muted-foreground',
  '已确认': 'bg-primary text-primary-foreground',
  '进行中': 'bg-chart-1 text-primary-foreground',
  '已完成': 'bg-chart-2 text-primary-foreground',
  '已取消': 'bg-destructive text-destructive-foreground',
};

export default function PersonDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [person, setPerson] = useState<Person | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadPersonDetail();
    }
  }, [id]);

  const loadPersonDetail = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [personData, activitiesData] = await Promise.all([
        getPerson(id),
        getPersonActivities(id),
      ]);
      setPerson(personData);
      setActivities(activitiesData);
    } catch (error) {
      console.error('加载人员详情失败:', error);
      toast.error('加载人员详情失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full bg-muted" />
        <Skeleton className="h-96 bg-muted" />
      </div>
    );
  }

  if (!person) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">人员不存在</p>
        <Button onClick={() => navigate('/persons')} className="mt-4">
          返回列表
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/persons')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold text-foreground">人员详情</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center">
              <Avatar className="h-32 w-32">
                <AvatarImage src={person.photo_url} alt={person.name} />
                <AvatarFallback className="text-4xl">{person.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <h2 className="text-2xl font-bold mt-4">{person.name}</h2>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">联系方式</p>
                  <p className="font-medium">{person.contact}</p>
                </div>
              </div>

              {person.gender && (
                <>
                  <Separator />
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">性别</p>
                      <p className="font-medium">{person.gender}</p>
                    </div>
                  </div>
                </>
              )}

              {person.age && (
                <>
                  <Separator />
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">年龄</p>
                      <p className="font-medium">{person.age}岁</p>
                    </div>
                  </div>
                </>
              )}

              {person.height && (
                <>
                  <Separator />
                  <div className="flex items-center gap-3">
                    <Ruler className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">身高</p>
                      <p className="font-medium">{person.height}cm</p>
                    </div>
                  </div>
                </>
              )}

              {person.weight && (
                <>
                  <Separator />
                  <div className="flex items-center gap-3">
                    <Weight className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">体重</p>
                      <p className="font-medium">{person.weight}kg</p>
                    </div>
                  </div>
                </>
              )}

              {person.id_number && (
                <>
                  <Separator />
                  <div className="flex items-center gap-3">
                    <IdCard className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">身份证号</p>
                      <p className="font-medium">{person.id_number}</p>
                    </div>
                  </div>
                </>
              )}

              {person.expertise && (
                <>
                  <Separator />
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">擅长领域</p>
                      <p className="font-medium">{person.expertise}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-6">
          {person.notes && (
            <Card>
              <CardHeader>
                <CardTitle>备注</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground whitespace-pre-wrap">{person.notes}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>参与活动 ({activities.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无参与活动</p>
              ) : (
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => navigate(`/activities/${activity.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">{activity.name}</h3>
                          <Badge className={statusColors[activity.status] || 'bg-muted'}>
                            {activity.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>
                            {activity.start_date ? format(new Date(activity.start_date), 'yyyy年MM月dd日', { locale: zhCN }) : '未设置日期'}
                          </span>
                          <span>{activity.location}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
