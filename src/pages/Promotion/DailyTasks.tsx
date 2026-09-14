import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, RotateCcw, ClipboardEdit, ListChecks } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  getPromotionTasks,
  getPromotionTaskRecordsByDateRange,
  getPromotionTaskDetails,
  upsertPromotionTaskRecord,
  upsertPromotionTaskDetail,
  getOrCreatePromotionTaskDetail,
  getActivities,
} from '@/db/api';
import type { PromotionTask, PromotionTaskRecord, PromotionTaskDetail, Activity } from '@/types';
import { PromotionStatusBadge } from '@/components/promotion/PromotionStatusBadge';
import PromotionDetailDialog, { formatActualTime } from '@/components/promotion/PromotionDetailDialog';
import { calcPromotionStatus, canSetCompletion, formatDateStr, isTaskActiveOnDate } from '@/lib/promotion';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface DayTaskItem {
  task: PromotionTask;
  record?: PromotionTaskRecord;
  detail?: PromotionTaskDetail | null;
  status: '已完成' | '未完成' | '已错过';
}

export default function PromotionDailyTasks() {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [tasks, setTasks] = useState<PromotionTask[]>([]);
  const [records, setRecords] = useState<PromotionTaskRecord[]>([]);
  const [details, setDetails] = useState<Map<string, PromotionTaskDetail>>(new Map());
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [operating, setOperating] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [month, setMonth] = useState<Date>(new Date());
  const [editOpen, setEditOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<DayTaskItem | null>(null);

  // 加载任务设置与活动列表
  useEffect(() => {
    loadTasks();
    loadActivities();
  }, []);

  const loadTasks = async () => {
    try {
      const data = await getPromotionTasks();
      setTasks(data);
    } catch (error) {
      console.error('加载任务设置失败:', error);
      toast.error('加载任务设置失败');
    } finally {
      setLoading(false);
    }
  };

  const loadActivities = async () => {
    try {
      const data = await getActivities();
      setActivities(data);
    } catch (error) {
      console.error('加载活动列表失败:', error);
      toast.error('加载活动列表失败');
    }
  };

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

  // 加载指定月份的记录及对应详情
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
      console.error('加载任务记录失败:', error);
      toast.error('加载任务记录失败');
    }
  }, []);

  useEffect(() => {
    loadRecords(month);
  }, [month, loadRecords]);

  // 选中日期的任务列表：启用且处于生效周期内的任务 ∪ 该天有记录的任务
  const dayTasks: DayTaskItem[] = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = formatDateStr(selectedDate);
    const dayRecords = records.filter((r) => r.record_date === dateStr);
    const recordedTaskIds = new Set(dayRecords.map((r) => r.task_id));

    const activeTasks = tasks.filter((t) => t.status === '启用' && isTaskActiveOnDate(t, selectedDate));
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

  const isToday = selectedDate ? canSetCompletion(selectedDate) : false;

  // 任务的默认推广活动列表（默认与任务活动列表相同）
  const getDefaultActivityIds = (task: PromotionTask): string => task.activity_list || '';

  // 标记完成 / 取消完成（仅今天）
  const handleToggleComplete = async (item: DayTaskItem) => {
    if (!selectedDate || !isToday) return;
    const dateStr = formatDateStr(selectedDate);
    const willComplete = !item.record?.is_completed;
    try {
      setOperating(item.task.id);
      const rec = await upsertPromotionTaskRecord({
        task_id: item.task.id,
        record_date: dateStr,
        is_completed: willComplete,
        notes: item.record?.notes ?? '',
      });
      if (willComplete) {
        await getOrCreatePromotionTaskDetail(rec.id, {
          actual_time: new Date().toISOString(),
          activity_ids: getDefaultActivityIds(item.task),
        });
      }
      toast.success(willComplete ? '已标记完成' : '已取消完成');
      await loadRecords(month);
    } catch (error) {
      console.error('更新任务状态失败:', error);
      toast.error('更新任务状态失败');
    } finally {
      setOperating(null);
    }
  };

  // 打开实际推广详情编辑
  const handleOpenEdit = (item: DayTaskItem) => {
    if (!selectedDate || !isToday || !item.record) return;
    setEditingTask(item);
    setEditOpen(true);
  };

  // 保存实际推广详情
  const handleSaveDetail = async (
    detailData: { actual_time?: string | null; activity_ids?: string | null; channel?: string | null; conversions: number },
    notes: string | null
  ) => {
    if (!editingTask?.record || !selectedDate) return;
    try {
      setOperating(editingTask.task.id);
      await upsertPromotionTaskDetail(editingTask.record.id, detailData);
      await upsertPromotionTaskRecord({
        task_id: editingTask.task.id,
        record_date: formatDateStr(selectedDate),
        is_completed: editingTask.record.is_completed,
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

  // 当月统计
  const monthStats = useMemo(() => {
    const completed = records.filter((r) => r.is_completed).length;
    return { total: records.length, completed };
  }, [records]);

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4 mb-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">每日任务</h1>
            <p className="text-sm text-muted-foreground mt-1">
              点击日历中的日期查看当天任务，仅今天可设置完成状态（今天之前的日期不支持点击）
            </p>
          </div>
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
                disabled={{ before: today }}
                className="rounded-md border w-full"
              />
            </div>
            <div className="space-y-2 text-sm text-muted-foreground border-t pt-3">
              <div className="flex items-center justify-between">
                <span>本月已完成任务</span>
                <span className="font-medium text-foreground">{monthStats.completed}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>本月任务记录总数</span>
                <span className="font-medium text-foreground">{monthStats.total}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 当天任务列表 */}
        <Card className="col-span-full md:col-span-7 lg:col-span-8 min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5" />
              {selectedDate ? `${format(selectedDate, 'yyyy年M月d日', { locale: zhCN })} 的任务` : '请选择日期'}
              {!isToday && selectedDate && (
                <span className="text-xs font-normal text-muted-foreground">（仅查看，非当天不能设置完成状态）</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : dayTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <ListChecks className="h-10 w-10 mb-3 opacity-30" />
                <p>当天暂无任务</p>
                <p className="text-xs mt-1">可在「任务设置」中添加默认任务（每天展示）</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dayTasks.map((item) => (
                  <div
                    key={item.task.id}
                    className="rounded-lg border bg-card p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{item.task.name}</span>
                          <PromotionStatusBadge status={item.status} />
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span>推广时间：{item.task.promotion_time.slice(0, 5)}</span>
                          <span>通用：{item.task.is_common ? '是' : '否'}</span>
                          <span>周期：{item.task.cycle_type}</span>
                        </div>
                      </div>
                      {isToday && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant={item.record?.is_completed ? 'outline' : 'default'}
                            size="sm"
                            onClick={() => handleToggleComplete(item)}
                            disabled={operating === item.task.id}
                          >
                            {item.record?.is_completed ? (
                              <>
                                <RotateCcw className="h-4 w-4 mr-1" />
                                取消完成
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                标记完成
                              </>
                            )}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenEdit(item)}
                            disabled={operating === item.task.id || !item.record}
                          >
                            <ClipboardEdit className="h-4 w-4 mr-1" />
                            推广详情
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1 text-sm border-t border-border pt-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-muted-foreground shrink-0">推广时间：</span>
                        <span className="truncate">{formatActualTime(item.detail?.actual_time)}</span>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-muted-foreground shrink-0">推广活动：</span>
                        <span className="truncate">{activityNamesFromIds(item.detail?.activity_ids)}</span>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-muted-foreground shrink-0">推广渠道：</span>
                        <span className="truncate">{item.detail?.channel || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground shrink-0">转化人数：</span>
                        <span>{item.detail?.conversions ?? 0}</span>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-muted-foreground shrink-0">活动列表：</span>
                        <span className="truncate">{getActivityNames(item.task)}</span>
                      </div>
                    </div>

                    {item.record?.notes || item.task.notes ? (
                      <div className="flex items-start gap-2 text-sm border-t border-border pt-2">
                        <span className="text-muted-foreground shrink-0">备注：</span>
                        <span className="text-muted-foreground break-words">{item.record?.notes || item.task.notes}</span>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 实际推广详情编辑对话框 */}
      <PromotionDetailDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        detail={editingTask?.detail}
        notes={editingTask?.record?.notes}
        activities={activities}
        defaultActivityIds={editingTask ? getDefaultActivityIds(editingTask.task) : null}
        onSubmit={handleSaveDetail}
      />
    </div>
  );
}
