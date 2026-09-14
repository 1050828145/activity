import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Plus, Search, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getActivities } from '@/db/api';
import { cn } from '@/lib/utils';
import type { Activity } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

const statusColors: Record<string, string> = {
  '待确认': 'bg-yellow-500',
  '已确认': 'bg-blue-500',
  '进行中': 'bg-green-500',
  '已完成': 'bg-gray-500',
  '已取消': 'bg-red-500',
};

export default function MobileActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadActivities();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = activities.filter(
        (activity) =>
          activity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          activity.location?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredActivities(filtered);
    } else {
      setFilteredActivities(activities);
    }
  }, [searchTerm, activities]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const data = await getActivities();
      setActivities(data);
      setFilteredActivities(data);
    } catch (error) {
      console.error('加载活动失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-10 w-full bg-muted" />
        <Skeleton className="h-10 w-full bg-muted" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 头部 */}
      <div className="sticky top-0 z-10 bg-card border-b border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">活动管理</h1>
          <Link to="/mobile/activities/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              新建
            </Button>
          </Link>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索活动名称或地点..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* 活动列表 */}
      <div className="p-4 space-y-3">
        {filteredActivities.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {searchTerm ? '没有找到匹配的活动' : '暂无活动，点击右上角新建'}
            </CardContent>
          </Card>
        ) : (
          filteredActivities.map((activity) => (
            <Link key={activity.id} to={`/mobile/activities/${activity.id}`}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-foreground line-clamp-1">
                      {activity.name}
                    </h3>
                    <Badge className={statusColors[activity.status] || 'bg-muted'}>
                      {activity.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarIcon className="h-4 w-4" />
                    <span>
                      {activity.type === '长期' ? '长期活动' : (activity.start_date || '-')}
                    </span>
                  </div>
                  {activity.location && (
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      📍 {activity.location}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                    <div className="flex gap-3">
                      <span>需求: {activity.required_people || '-'}</span>
                      <span>已报: <span className={cn(
                        "font-medium",
                        activity.required_people > 0 && (activity.participant_count || 0) >= activity.required_people ? "text-green-500" : "text-foreground"
                      )}>{activity.participant_count || 0}</span></span>
                    </div>
                    <span>工资: {activity.part_time_salary ? `¥${activity.part_time_salary}` : '-'}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
