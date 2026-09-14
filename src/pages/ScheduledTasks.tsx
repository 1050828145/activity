import { useState, useEffect } from 'react';
import { Plus, Play, Pause, Trash2, Edit, Clock, Calendar, History, Activity, Power, PowerOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  getScheduledTasks,
  deleteScheduledTask,
  updateScheduledTask,
  getTaskExecutionLogs,
  getSchedulerEnabled,
  setSchedulerEnabled,
} from '@/db/api';
import type { ScheduledTask, TaskExecutionLog } from '@/types';
import TaskDialog from '@/components/tasks/TaskDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import cronstrue from 'cronstrue/i18n';
import { getSchedulerStatus } from '@/services/TaskScheduler';

export default function ScheduledTasks() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [selectedTaskLogs, setSelectedTaskLogs] = useState<TaskExecutionLog[]>([]);
  const [selectedTaskName, setSelectedTaskName] = useState('');
  const [schedulerStatus, setSchedulerStatus] = useState<any>(null);
  const [schedulerEnabled, setSchedulerEnabledState] = useState(true);
  const [updatingScheduler, setUpdatingScheduler] = useState(false);

  useEffect(() => {
    loadTasks();
    loadSchedulerEnabled();
    updateSchedulerStatus();
    
    // 每5秒更新一次调度器状态
    const interval = setInterval(updateSchedulerStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadSchedulerEnabled = async () => {
    try {
      const enabled = await getSchedulerEnabled();
      setSchedulerEnabledState(enabled);
    } catch (error: any) {
      console.error('加载调度器状态失败:', error);
    }
  };

  const updateSchedulerStatus = () => {
    const status = getSchedulerStatus();
    setSchedulerStatus(status);
  };

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await getScheduledTasks();
      setTasks(data);
    } catch (error: any) {
      toast.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingTask(null);
    setDialogOpen(true);
  };

  const handleEdit = (task: ScheduledTask) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeletingTaskId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingTaskId) return;

    try {
      await deleteScheduledTask(deletingTaskId);
      toast.success('任务删除成功');
      loadTasks();
    } catch (error: any) {
      toast.error(error.message || '删除失败');
    } finally {
      setDeleteDialogOpen(false);
      setDeletingTaskId(null);
    }
  };

  const handleToggleEnabled = async (task: ScheduledTask) => {
    try {
      await updateScheduledTask(task.id, { enabled: !task.enabled });
      toast.success(task.enabled ? '任务已暂停' : '任务已启用');
      loadTasks();
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    }
  };

  const handleToggleScheduler = async (enabled: boolean) => {
    try {
      setUpdatingScheduler(true);
      await setSchedulerEnabled(enabled);
      setSchedulerEnabledState(enabled);
      toast.success(enabled ? '调度器已启用' : '调度器已关闭');
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    } finally {
      setUpdatingScheduler(false);
    }
  };

  const handleViewLogs = async (task: ScheduledTask) => {
    try {
      const logs = await getTaskExecutionLogs(task.id);
      setSelectedTaskLogs(logs);
      setSelectedTaskName(task.name);
      setLogsDialogOpen(true);
    } catch (error: any) {
      toast.error(error.message || '加载日志失败');
    }
  };

  const getTaskTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      send_email: '发送邮件',
      data_cleanup: '数据清理',
      report_generation: '报表生成',
      custom: '自定义任务',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (enabled: boolean) => {
    return enabled ? (
      <Badge variant="default" className="bg-green-500">运行中</Badge>
    ) : (
      <Badge variant="secondary">已暂停</Badge>
    );
  };

  const getCronDescription = (cron: string) => {
    try {
      return cronstrue.toString(cron, { locale: 'zh_CN' });
    } catch {
      return cron;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">定时任务</h1>
          <p className="text-muted-foreground mt-2">管理系统的定时任务和自动化流程</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          新建任务
        </Button>
      </div>

      {/* 内置调度器说明 */}
      <div className="mb-6 space-y-4">
        {/* 调度器全局开关 */}
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {schedulerEnabled ? (
                  <Power className="h-5 w-5 text-green-600" />
                ) : (
                  <PowerOff className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <CardTitle className="text-lg">调度器总开关</CardTitle>
                  <CardDescription>
                    {schedulerEnabled ? '调度器已启用，定时任务将按计划执行' : '调度器已关闭，所有定时任务暂停执行'}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="scheduler-switch" className="text-sm font-medium">
                  {schedulerEnabled ? '已启用' : '已关闭'}
                </Label>
                <Switch
                  id="scheduler-switch"
                  checked={schedulerEnabled}
                  onCheckedChange={handleToggleScheduler}
                  disabled={updatingScheduler}
                />
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* 调度器状态信息 */}
        <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              <Activity className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-green-900 dark:text-green-100">
                  {schedulerStatus?.isRunning ? '✅ 调度器运行中' : '❌ 调度器未运行'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={updateSchedulerStatus}
                >
                  刷新状态
                </Button>
              </div>
              {schedulerStatus && (
                <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
                  <p>实例 ID: <code className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900 rounded text-xs font-mono">{schedulerStatus.instanceId}</code></p>
                  <p>检查间隔: {schedulerStatus.checkInterval / 1000} 秒</p>
                  <p>已执行任务: {schedulerStatus.executionCount} 次</p>
                  {schedulerStatus.lastCheckTime && (
                    <p>上次检查: {new Date(schedulerStatus.lastCheckTime).toLocaleString('zh-CN')}</p>
                  )}
                  <p className="text-xs mt-2">
                    💡 提示: 打开浏览器控制台可以看到详细的彩色日志输出
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2 mt-2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-full"></div>
                <div className="h-4 bg-muted rounded w-2/3 mt-2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              还没有定时任务
              <br />
              点击"新建任务"创建第一个定时任务
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <Card key={task.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{task.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {getTaskTypeLabel(task.task_type)}
                    </CardDescription>
                  </div>
                  {getStatusBadge(task.enabled)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {task.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {task.description}
                  </p>
                )}

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span className="flex-1">{getCronDescription(task.cron_expression)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span className="flex-1">
                      {task.last_execution_time
                        ? `上次执行：${new Date(task.last_execution_time).toLocaleString('zh-CN')}`
                        : '尚未执行'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleEnabled(task)}
                    className="flex-1"
                  >
                    {task.enabled ? (
                      <>
                        <Pause className="h-4 w-4 mr-1" />
                        暂停
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-1" />
                        启用
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewLogs(task)}
                  >
                    <History className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(task)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(task.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
        onSuccess={loadTasks}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个定时任务吗？此操作无法撤销，相关的执行日志也会被删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>执行日志 - {selectedTaskName}</DialogTitle>
            <DialogDescription>
              查看任务的历史执行记录
            </DialogDescription>
          </DialogHeader>

          {selectedTaskLogs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              暂无执行记录
            </div>
          ) : (
            <div className="space-y-3">
              {selectedTaskLogs.map((log) => (
                <div
                  key={log.id}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {log.status === 'success' && (
                        <Badge variant="default" className="bg-green-500">成功</Badge>
                      )}
                      {log.status === 'failed' && (
                        <Badge variant="destructive">失败</Badge>
                      )}
                      {log.status === 'running' && (
                        <Badge variant="secondary">运行中</Badge>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {new Date(log.started_at).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    {log.completed_at && (
                      <span className="text-xs text-muted-foreground">
                        耗时：{Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)}秒
                      </span>
                    )}
                  </div>

                  {log.error_message && (
                    <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                      {log.error_message}
                    </div>
                  )}

                  {log.execution_details && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        查看详情
                      </summary>
                      <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                        {JSON.stringify(log.execution_details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
