import { useState, useEffect } from 'react';
import { Plus, Mail, Clock, Calendar, Settings, Trash2, Edit, Power, PowerOff, Send } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  getEmailNotifications,
  deleteEmailNotification,
  updateEmailNotification,
  getUserProfile,
} from '@/db/api';
import type { EmailNotification } from '@/types';
import EmailNotificationDialog from '@/components/notifications/EmailNotificationDialog';
import EmailConfigDialog from '@/components/notifications/EmailConfigDialog';
import TestEmailDialog from '@/components/notifications/TestEmailDialog';
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

export default function EmailNotifications() {
  const [notifications, setNotifications] = useState<EmailNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [editingNotification, setEditingNotification] = useState<EmailNotification | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isRoot, setIsRoot] = useState(false);

  useEffect(() => {
    loadNotifications();
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
    try {
      const profile = await getUserProfile();
      setIsRoot(profile?.username === 'root');
    } catch (error) {
      console.error('检查用户角色失败:', error);
    }
  };

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await getEmailNotifications();
      setNotifications(data);
    } catch (error) {
      console.error('加载邮件通知任务失败:', error);
      toast.error('加载邮件通知任务失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingNotification(null);
    setDialogOpen(true);
  };

  const handleEdit = (notification: EmailNotification) => {
    setEditingNotification(notification);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;

    try {
      await deleteEmailNotification(deletingId);
      toast.success('删除成功');
      loadNotifications();
    } catch (error) {
      console.error('删除邮件通知任务失败:', error);
      toast.error('删除失败');
    } finally {
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  const handleToggleEnabled = async (notification: EmailNotification) => {
    try {
      await updateEmailNotification(notification.id, {
        enabled: !notification.enabled,
      });
      toast.success(notification.enabled ? '已禁用' : '已启用');
      loadNotifications();
    } catch (error) {
      console.error('更新邮件通知任务失败:', error);
      toast.error('更新失败');
    }
  };

  const getScheduleTypeText = (type: string) => {
    switch (type) {
      case 'daily':
        return '每天';
      case 'weekdays':
        return '工作日';
      case 'custom':
        return '自定义';
      default:
        return type;
    }
  };

  const getScheduleDaysText = (days?: number[]) => {
    if (!days || days.length === 0) return '';
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days.map(d => dayNames[d]).join('、');
  };

  const getContentTypesText = (types: string[]) => {
    const typeMap: Record<string, string> = {
      registrations: '报名情况',
      todos: '待办事项',
      notes: '备注信息',
    };
    return types.map(t => typeMap[t] || t).join('、');
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">邮箱通知</h1>
          <p className="text-muted-foreground mt-2">定时通过邮箱发送活动报名情况和待办事项</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTestDialogOpen(true)}>
            <Send className="h-4 w-4 mr-2" />
            测试邮件发送
          </Button>
          {isRoot && (
            <Button variant="outline" onClick={() => setConfigDialogOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              邮箱配置
            </Button>
          )}
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            新建通知任务
          </Button>
        </div>
      </div>

      {/* 自动化配置提示 */}
      {notifications.length > 0 && (
        <div className="mb-6 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1 text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                💡 定时任务需要配置自动化触发器
              </p>
              <p className="text-blue-800 dark:text-blue-200">
                请查看项目根目录的 <code className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 rounded text-xs font-mono">CRON_SETUP.md</code> 文件，
                按照说明配置 GitHub Actions 或其他免费 Cron 服务，即可实现自动定时发送。
              </p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2 mt-2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded"></div>
                  <div className="h-4 bg-muted rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground mb-2">暂无邮件通知任务</p>
            <p className="text-muted-foreground mb-4">创建您的第一个邮件通知任务</p>
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              新建通知任务
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {notifications.map((notification) => (
            <Card key={notification.id} className={notification.enabled ? '' : 'opacity-60'}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {notification.name}
                      {notification.enabled ? (
                        <Badge variant="default" className="ml-2">
                          <Power className="h-3 w-3 mr-1" />
                          启用
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="ml-2">
                          <PowerOff className="h-3 w-3 mr-1" />
                          禁用
                        </Badge>
                      )}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{notification.schedule_time}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">
                    {getScheduleTypeText(notification.schedule_type)}
                    {notification.schedule_type === 'custom' && notification.schedule_days && (
                      <span className="text-muted-foreground ml-1">
                        ({getScheduleDaysText(notification.schedule_days)})
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span className="text-foreground flex-1">
                    {getContentTypesText(notification.content_types)}
                  </span>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleToggleEnabled(notification)}
                  >
                    {notification.enabled ? (
                      <>
                        <PowerOff className="h-4 w-4 mr-1" />
                        禁用
                      </>
                    ) : (
                      <>
                        <Power className="h-4 w-4 mr-1" />
                        启用
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(notification)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(notification.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EmailNotificationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        notification={editingNotification}
        onSuccess={loadNotifications}
      />

      <TestEmailDialog
        open={testDialogOpen}
        onOpenChange={setTestDialogOpen}
      />

      {isRoot && (
        <EmailConfigDialog
          open={configDialogOpen}
          onOpenChange={setConfigDialogOpen}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个邮件通知任务吗？此操作无法撤销。
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
