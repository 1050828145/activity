import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
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
import { toast } from 'sonner';
import { getActivityTypes, createActivityType, updateActivityType, deleteActivityType } from '@/db/api';
import type { ActivityType, ActivityTypeFormData } from '@/types';
import ActivityTypeForm from '@/components/activity-types/ActivityTypeForm';
import { useAuthCheck } from '@/hooks/use-auth-check';

export default function ActivityTypes() {
  const { checkAuth } = useAuthCheck();
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ActivityType | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadActivityTypes();
  }, []);

  const loadActivityTypes = async () => {
    try {
      const data = await getActivityTypes();
      setActivityTypes(data);
    } catch (error) {
      console.error('加载活动类型失败:', error);
      toast.error('加载活动类型失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    if (!checkAuth('创建活动类型')) return;
    setEditingType(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (type: ActivityType) => {
    if (!checkAuth('编辑活动类型')) return;
    setEditingType(type);
    setDialogOpen(true);
  };

  const handleSubmit = async (data: ActivityTypeFormData) => {
    try {
      if (editingType) {
        if (!checkAuth('更新活动类型')) return;
        await updateActivityType(editingType.id, data);
        toast.success('活动类型更新成功');
      } else {
        if (!checkAuth('创建活动类型')) return;
        await createActivityType(data);
        toast.success('活动类型创建成功');
      }
      setDialogOpen(false);
      loadActivityTypes();
    } catch (error: any) {
      console.error('保存活动类型失败:', error);
      toast.error(error.message || '保存活动类型失败');
    }
  };

  const handleDelete = (id: string) => {
    if (!checkAuth('删除活动类型')) return;
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteActivityType(deleteId);
      toast.success('活动类型删除成功');
      loadActivityTypes();
    } catch (error) {
      console.error('删除活动类型失败:', error);
      toast.error('删除活动类型失败');
    } finally {
      setDeleteId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">活动类型管理</h1>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          新增类型
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>活动类型列表</CardTitle>
        </CardHeader>
        <CardContent className="max-h-[calc(100vh-280px)] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>类型名称</TableHead>
                <TableHead>描述</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activityTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    暂无活动类型
                  </TableCell>
                </TableRow>
              ) : (
                activityTypes.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell>{type.description || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(type)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(type.id)}
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
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingType ? '编辑活动类型' : '新增活动类型'}
            </DialogTitle>
          </DialogHeader>
          <ActivityTypeForm
            activityType={editingType}
            onSubmit={handleSubmit}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个活动类型吗？此操作无法撤销。
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
