import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Pencil, Trash2, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  getPromotionTasks,
  createPromotionTask,
  updatePromotionTask,
  deletePromotionTask,
  getActivities,
} from '@/db/api';
import type { PromotionTask, PromotionTaskFormData, Activity } from '@/types';
import PromotionTaskForm from '@/components/promotion/PromotionTaskForm';
import { useAuthCheck } from '@/hooks/use-auth-check';

export default function PromotionTaskSettings() {
  const { checkAuth } = useAuthCheck();
  const location = useLocation();
  const [tasks, setTasks] = useState<PromotionTask[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<PromotionTask | undefined>();
  const [initialData, setInitialData] = useState<
    (Partial<PromotionTaskFormData> & { activity_names?: string }) | undefined
  >();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  // 监听来自 AI 推荐任务跳转的路由 state，自动打开新增任务弹窗并预填参数
  useEffect(() => {
    const state = location.state as {
      openNewTask?: boolean;
      prefillTask?: Partial<PromotionTaskFormData> & { activity_names?: string };
    } | null;

    if (state?.openNewTask) {
      setEditingTask(undefined);
      setInitialData(state.prefillTask);
      setDialogOpen(true);
      // 清除 state，避免刷新页面重复弹出
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

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

  const handleAdd = () => {
    if (!checkAuth('创建任务')) return;
    setEditingTask(undefined);
    setInitialData(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (task: PromotionTask) => {
    if (!checkAuth('编辑任务')) return;
    setEditingTask(task);
    setDialogOpen(true);
  };

  const handleSubmit = async (data: PromotionTaskFormData) => {
    try {
      if (editingTask) {
        if (!checkAuth('更新任务')) return;
        await updatePromotionTask(editingTask.id, data);
        toast.success('任务更新成功');
      } else {
        if (!checkAuth('创建任务')) return;
        await createPromotionTask(data);
        toast.success('任务创建成功');
      }
      setDialogOpen(false);
      loadTasks();
    } catch (error: any) {
      console.error('保存任务失败:', error);
      toast.error(error.message || '保存任务失败');
    }
  };

  // 快速切换启用/停用
  const handleToggleStatus = async (task: PromotionTask) => {
    if (!checkAuth('更新任务')) return;
    try {
      setStatusUpdating(task.id);
      await updatePromotionTask(task.id, { ...task, status: task.status === '启用' ? '停用' : '启用' });
      toast.success(task.status === '启用' ? '已停用' : '已启用');
      loadTasks();
    } catch (error: any) {
      console.error('更新任务状态失败:', error);
      toast.error(error.message || '更新任务状态失败');
    } finally {
      setStatusUpdating(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deletePromotionTask(deleteId);
      toast.success('任务删除成功');
      loadTasks();
    } catch (error) {
      console.error('删除任务失败:', error);
      toast.error('删除任务失败');
    } finally {
      setDeleteId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="sticky top-0 z-10 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4 mb-6 border-b">
          <h1 className="text-3xl font-bold">任务设置</h1>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4 mb-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">任务设置</h1>
            <p className="text-sm text-muted-foreground mt-1">
              管理默认推广任务，可修改、删除任务；停用的任务不展示在每日任务中
            </p>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            新增任务
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            任务列表
          </CardTitle>
        </CardHeader>
        <CardContent className="max-h-[calc(100vh-320px)] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>任务名称</TableHead>
                <TableHead>周期类型</TableHead>
                <TableHead>通用</TableHead>
                <TableHead>活动列表</TableHead>
                <TableHead>推广时间</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>备注</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    暂无任务，点击右上角"新增任务"创建
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="whitespace-nowrap">{task.cycle_type}</Badge>
                    </TableCell>
                    <TableCell>{task.is_common ? '是' : '否'}</TableCell>
                    <TableCell className="max-w-40 truncate" title={getActivityNames(task)}>
                      {getActivityNames(task)}
                    </TableCell>
                    <TableCell>{task.promotion_time.slice(0, 5)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={task.status === '启用'}
                          onCheckedChange={() => handleToggleStatus(task)}
                          disabled={statusUpdating === task.id}
                        />
                        <span className={task.status === '启用' ? 'text-foreground' : 'text-muted-foreground'}>
                          {task.status}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-40 truncate">{task.notes || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(task)} title="修改">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (!checkAuth('删除任务')) return;
                            setDeleteId(task.id);
                          }}
                          title="删除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {tasks.length > 0 && (
            <div className="mt-3 flex gap-2 flex-wrap">
              <Badge variant="secondary">共 {tasks.length} 个任务</Badge>
              <Badge variant="secondary">长期任务：{tasks.filter((t) => t.cycle_type === '长期任务').length}</Badge>
              <Badge variant="secondary">短期任务：{tasks.filter((t) => t.cycle_type === '短期任务').length}</Badge>
              <Badge variant="secondary">周期任务：{tasks.filter((t) => t.cycle_type === '周期任务').length}</Badge>
              <Badge variant="secondary">已停用：{tasks.filter((t) => t.status === '停用').length}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTask
                ? '编辑任务'
                : initialData
                ? '新增任务（AI推荐参数已预填）'
                : '新增任务'}
            </DialogTitle>
          </DialogHeader>
          <PromotionTaskForm
            task={editingTask}
            initialData={initialData}
            onSubmit={handleSubmit}
            onCancel={() => {
              setDialogOpen(false);
              setInitialData(undefined);
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个任务吗？关联的每日执行记录将一并删除，此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
