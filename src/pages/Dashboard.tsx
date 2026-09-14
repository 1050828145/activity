import { useEffect, useState } from 'react';
import { Calendar, Users, Activity, TrendingUp, UserCheck, DollarSign, Clock, Plus, UserPlus, CalendarPlus, UserCog } from 'lucide-react';
import StatsCard from '@/components/dashboard/StatsCard';
import { getStatistics } from '@/db/api';
import type { Statistics } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const data = await getStatistics();
      setStats(data);
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">仪表盘</h1>
          <p className="text-muted-foreground mt-2">活动与人员管理概览</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-32 bg-muted" />
          ))}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-4">今日新增</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={`today-${i}`} className="h-32 bg-muted" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">仪表盘</h1>
        <p className="text-muted-foreground mt-2">活动与人员管理概览</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="活动总数"
          value={stats?.total_activities || 0}
          icon={Calendar}
          description="已创建的活动数量"
          link="/activities"
        />
        <StatsCard
          title="人员总数"
          value={stats?.total_persons || 0}
          icon={Users}
          description="已录入的人员数量"
          link="/persons"
        />
        <StatsCard
          title="领队总数"
          value={stats?.total_leaders || 0}
          icon={UserCheck}
          description="已录入的领队数量"
          link="/leaders"
        />
        <StatsCard
          title="正在进行"
          value={stats?.ongoing_activities || 0}
          icon={Activity}
          description="当前正在进行的活动"
          link="/activities?status=进行中"
        />
        <StatsCard
          title="即将进行"
          value={stats?.upcoming_activities || 0}
          icon={TrendingUp}
          description="即将开始的活动"
          link="/activities?status=待确认,已确认&upcoming=true"
        />
        <StatsCard
          title="即将结束"
          value={stats?.ending_soon_activities || 0}
          icon={Clock}
          description="距离结束时间还有3天以内的活动"
          link="/activities?endingSoon=true"
          className={stats?.ending_soon_activities && stats.ending_soon_activities > 0 ? "border-destructive/50 bg-destructive/5" : ""}
        />
        <StatsCard
          title="待发薪人数"
          value={stats?.unpaid_participants || 0}
          icon={DollarSign}
          description="未发薪的参与人员"
          link="/participations"
        />
      </div>

      {/* 今日新增部分 */}
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-4">今日新增</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="新增活动"
            value={stats?.today_new_activities || 0}
            icon={CalendarPlus}
            description="今天新创建的活动"
            link="/activities"
            className="border-primary/30 bg-primary/5"
          />
          <StatsCard
            title="新增人员"
            value={stats?.today_new_persons || 0}
            icon={UserPlus}
            description="今天新录入的人员"
            link="/persons"
            className="border-primary/30 bg-primary/5"
          />
          <StatsCard
            title="新增领队"
            value={stats?.today_new_leaders || 0}
            icon={UserCog}
            description="今天新录入的领队"
            link="/leaders"
            className="border-primary/30 bg-primary/5"
          />
          <StatsCard
            title="新增参与记录"
            value={stats?.today_new_participants || 0}
            icon={Plus}
            description="今天新增的参与记录"
            link="/participations"
            className="border-primary/30 bg-primary/5"
          />
        </div>
      </div>
    </div>
  );
}
