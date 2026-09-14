import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, History, ClipboardList, ClipboardEdit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  getPromotionTasks,
  getPromotionTaskRecordsByDateRange,
  getPromotionTaskDetails,
  upsertPromotionTaskDetail,
  upsertPromotionTaskRecord,
  getActivities,
} from '@/db/api';
import type { PromotionTask, PromotionTaskRecord, PromotionTaskDetail, Activity } from '@/types';
import { PromotionStatusBadge } from '@/components/promotion/PromotionStatusBadge';
import PromotionDetailDialog, { formatActualTime } from '@/components/promotion/PromotionDetailDialog';
import { calcPromotionStatus, formatDateStr, isTaskActiveOnDate } from '@/lib/promotion';

interface DayItem {
  task: PromotionTask;
  record?: PromotionTaskRecord;
  detail?: PromotionTaskDetail | null;
  status: '已完成' | '未完成' | '已错过';
}

export default function PromotionRecords() {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  const [tasks, setTasks] = useState<PromotionTask[]>([]);
  const [records, setRecords] = useState<PromotionTaskRecord[]>([]);
  const [details, setDetails] = useState<Map<string, PromotionTaskDetail>>(new Map());
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [month, setMonth] = useState<Date>(new Date());
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DayItem | null>(null);
  const [operating, setOperating] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [tasksData, activitiesData] = await Promise.all([
          getPromotionTasks(),
          getActivities(),
        ]);
        setTasks(tasksData);
        setActivities(activitiesData);
      } catch (error) {
        console.error('加载数据失败:', error);
        toast.error('加载任务数据失败');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const getActivityNames = (task: PromotionTask) => {
    if (task.is_common) return '不指定';
    if (!task.activity_list) return '未指定';
    const ids = task.activity_list.split(',').map((id) => id.trim()).filter(Boolean);
    const names = ids
      .map((id) => activities.find((a) => a.id === id)?.name)
      .filter(Boolean) as string[];
    return names.length > 0 ? names.join('、') : '未指定';
  };

  const activityNamesFromIds = (ids?: string | null) => {
    if (!ids) return '-';
    const list = ids.split(',').map((id) => id.trim()).filter(Boolean);
    const names = list.map((id) => activities.find((a) => a.id === id)?.name).filter(Boolean) as string[];
    return names.length > 0 ? names.join('、') : '-';
  };

  const getDefaultActivityIds = (task: PromotionTask): string => task.activity_list || '';

  const loadRecords = useCallback(async (monthDate: Date) => {
    const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    try {
      const data = await getPromotionTaskRecordsByDateRange(formatDateStr(start), formatDateStr(end));
      setRecords(data);
      const detailList = await getPromotionTaskDetails(data.map((r) => r.id));
      const map = new Map<string, PromotionTaskDetail>();
      detailList.forEach((d) => map.set(d.record_id, d));
      setDetails(map);
    } catch (error) {
      console.error('加载推广记录失败:', error);
      toast.error('加载推广记录失败');
    }
  }, []);

  useEffect(() => {
    loadRecords(month);
  }, [month, loadRecords]);

  // 有执行记录的日期集合（用于日历角标）
  const recordDates = useMemo(() => {
    const dates = new Set(records.map((r) => r.record_date));
    const result: Date[] = [];
    const year = month.getFullYear();
    const m = month.getMonth();
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = formatDateStr(new Date(year, m, d));
      if (dates.has(dateStr)) {
        result.push(new Date(year, m, d));
      }
    }
    return result;
  }, [records, month]);

  // 选中日期的记录展示（含当日生效任务 + 有记录的任务）
  const dayItems: DayItem[] = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = formatDateStr(selectedDate);
    const dayRecords = records.filter((r) => r.record_date === dateStr);
    const recordedTaskIds = new Set(dayRecords.map((r) => r.task_id));

    const activeTasks = tasks.filter((t) => isTaskActiveOnDate(t, selectedDate));
    const extraTasks = tasks.filter((t) => !isTaskActiveOnDate(t, selectedDate) && recordedTaskIds.has(t.id));

    return [...activeTasks, ...extraTasks].map((task) => {
      const record = dayRecords.find((r) => r.task_id === task.id);
      return {
        task,
        record,
        detail: record ? details.get(record.id) : undefined,
        status: calcPromotionStatus(task, selectedDate, record),
      };
    });
  }, [tasks, records, details, selectedDate]);

  const completedCount = dayItems.filter((i) => i.record?.is_completed).length;
  const totalConversions = dayItems.reduce((sum, i) => sum + (i.detail?.conversions || 0), 0);

  // 打开实际推广详情编辑
  const handleOpenEdit = (item: DayItem) => {
    if (!item.record) return;
    setEditingItem(item);
    setEditOpen(true);
  };

  // 保存实际推广详情
  const handleSaveDetail = async (
    detailData: { actual_time?: string | null; activity_ids?: string | null; channel?: string | null; conversions: number },
    notes: string | null
  ) => {
    if (!editingItem?.record || !selectedDate) return;
    try {
      setOperating(editingItem.task.id);
      await upsertPromotionTaskDetail(editingItem.record.id, detailData);
      await upsertPromotionTaskRecord({
        task_id: editingItem.task.id,
        record_date: formatDateStr(selectedDate),
        is_completed: editingItem.record.is_completed,
        notes,
      });
      toast.success('推广详情已保存');
      setEditOpen(false);
      await loadRecords(month);
    } catch (error) {
      console.error('保存推广详情失败:', error);
      toast.error('保存推广详情失败');
    } finally {
      setOperating(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4 mb-6 border-b">
        <div>
          <h1 className="text-3xl font-bold">推广记录</h1>
          <p className="text-sm text-muted-foreground mt-1">
            点击日历中的日期查看之前执行的任务情况（今天之后的日期不支持点击）
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* 日历 */}
        <Card className="col-span-full md:col-span-5 lg:col-span-4 min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              选择日期
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="w-full flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                month={month}
                onMonthChange={setMonth}
                locale={zhCN}
                disabled={{ after: today }}
                modifiers={{
                  hasRecord: recordDates,
                }}
                modifiersClassNames={{
                  hasRecord: 'relative font-semibold after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary',
                }}
                className="rounded-md border w-full"
              />
            </div>
            <div className="space-y-2 text-sm text-muted-foreground border-t pt-3">
              <div className="flex items-center justify-between">
                <span>本月有记录的天数</span>
                <span className="font-medium text-foreground">{recordDates.length}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-1 w-1 rounded-full bg-primary" />
                <span className="text-xs">表示当天有执行记录</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 当天执行情况 */}
        <Card className="col-span-full md:col-span-7 lg:col-span-8 min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {selectedDate ? `${format(selectedDate, 'yyyy年M月d日', { locale: zhCN })} 执行情况` : '请选择日期'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : dayItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <ClipboardList className="h-10 w-10 mb-3 opacity-30" />
                <p>当天暂无任务记录</p>
              </div>
            ) : (
              <>
                <div className="flex gap-4 flex-wrap text-sm mb-4">
                  <span className="text-muted-foreground">
                    任务数：<span className="font-medium text-foreground">{dayItems.length}</span>
                  </span>
                  <span className="text-muted-foreground">
                    已完成：<span className="font-medium text-foreground">{completedCount}</span>
                  </span>
                  <span className="text-muted-foreground">
                    转化人数合计：<span className="font-medium text-foreground">{totalConversions}</span>
                  </span>
                </div>
                <div className="space-y-3">
                  {dayItems.map((item) => (
                    <div key={item.task.id} className="rounded-lg border bg-card p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{item.task.name}</span>
                        <PromotionStatusBadge status={item.status} />
                        {item.record && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="ml-auto shrink-0"
                            onClick={() => handleOpenEdit(item)}
                            disabled={operating === item.task.id}
                          >
                            <ClipboardEdit className="h-4 w-4 mr-1" />
                            推广详情
                          </Button>
                        )}
                      </div>
                      <div className="mt-1.5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>周期：{item.task.cycle_type}</span>
                        <span>推广时间：{item.task.promotion_time.slice(0, 5)}</span>
                        <span>实际推广时间：{formatActualTime(item.detail?.actual_time)}</span>
                        <span>转化人数：{item.detail?.conversions ?? 0}</span>
                        <span className="truncate" title={activityNamesFromIds(item.detail?.activity_ids)}>
                          推广活动：{activityNamesFromIds(item.detail?.activity_ids)}
                        </span>
                        <span className="truncate" title={item.detail?.channel || undefined}>
                          推广渠道：{item.detail?.channel || '-'}
                        </span>
                        <span className="truncate" title={getActivityNames(item.task)}>
                          活动列表：{getActivityNames(item.task)}
                        </span>
                      </div>
                      {(item.record?.notes || item.task.notes) && (
                        <div className="mt-2 flex items-start gap-2 text-sm border-t border-border pt-2">
                          <span className="shrink-0">备注：</span>
                          <span className="break-words">{item.record?.notes || item.task.notes}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 实际推广详情编辑对话框 */}
      <PromotionDetailDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        detail={editingItem?.detail}
        notes={editingItem?.record?.notes}
        activities={activities}
        defaultActivityIds={editingItem ? getDefaultActivityIds(editingItem.task) : null}
        onSubmit={handleSaveDetail}
      />
    </div>
  );
}
