import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router';
import { ArrowLeft, Calendar, MapPin, Users, DollarSign, Plus, Edit, Trash2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { getActivity, getActivityParticipantsWithDetails, updateParticipantDetails, removeActivityParticipant, markAllParticipantsAsPaid } from '@/db/api';
import type { Activity } from '@/types';
import SmartPersonInput from '@/components/mobile/SmartPersonInput';
import QRCodeGenerator from '@/components/mobile/QRCodeGenerator';
import OnlineActivityParticipantsDialog from '@/components/activities/OnlineActivityParticipantsDialog';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  '待确认': 'bg-yellow-500',
  '已确认': 'bg-blue-500',
  '进行中': 'bg-green-500',
  '已完成': 'bg-gray-500',
  '已取消': 'bg-red-500',
};

interface EditParticipantForm {
  salary?: number;
  deposit?: number;
  per_head_fee?: number;
  is_paid: boolean;
}

export default function MobileActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<any>(null);
  const [deletingParticipant, setDeletingParticipant] = useState<any>(null);
  const [activeSection, setActiveSection] = useState('info');
  const [onlineParticipantsOpen, setOnlineParticipantsOpen] = useState(false);

  // 创建各区域的引用
  const infoRef = useRef<HTMLDivElement>(null);
  const feeRef = useRef<HTMLDivElement>(null);
  const participantsRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);

  // 编辑表单
  const form = useForm<EditParticipantForm>({
    defaultValues: {
      salary: undefined,
      deposit: undefined,
      per_head_fee: undefined,
      is_paid: false,
    },
  });

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [activityData, participantsData] = await Promise.all([
        getActivity(id!),
        getActivityParticipantsWithDetails(id!),
      ]);
      setActivity(activityData);
      setParticipants(participantsData);
    } catch (error) {
      console.error('加载活动详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSuccess = () => {
    setAddDialogOpen(false);
    loadData();
  };

  // 打开编辑对话框
  const handleEditParticipant = (participant: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingParticipant(participant);
    form.reset({
      salary: participant.salary || undefined,
      deposit: participant.deposit || undefined,
      per_head_fee: participant.per_head_fee || undefined,
      is_paid: participant.is_paid || false,
    });
    setEditDialogOpen(true);
  };

  // 打开删除确认对话框
  const handleDeleteClick = (participant: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingParticipant(participant);
    setDeleteDialogOpen(true);
  };

  // 确认删除
  const handleConfirmDelete = async () => {
    if (!deletingParticipant) return;

    try {
      await removeActivityParticipant(id!, deletingParticipant.person_id);
      toast.success('删除成功');
      setDeleteDialogOpen(false);
      setDeletingParticipant(null);
      loadData();
    } catch (error) {
      console.error('删除失败:', error);
      toast.error('删除失败，请重试');
    }
  };

  // 保存编辑
  const handleSaveEdit = async (values: EditParticipantForm) => {
    if (!editingParticipant) return;

    try {
      // 只更新参与记录
      await updateParticipantDetails(id!, editingParticipant.person_id, {
        salary: values.salary,
        deposit: values.deposit,
        per_head_fee: values.per_head_fee,
        is_paid: values.is_paid,
      });

      toast.success('更新成功');
      setEditDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('更新失败:', error);
      toast.error('更新失败，请重试');
    }
  };

  // 一键发薪完毕
  const handleMarkAllPaid = async () => {
    if (!id) return;
    try {
      await markAllParticipantsAsPaid(id);
      toast.success('已将该活动所有参与人员状态标记为已发薪');
      loadData();
    } catch (error) {
      console.error('一键发薪失败:', error);
      toast.error('一键发薪失败');
    }
  };

  // 滚动到指定区域
  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>, section: string) => {
    setActiveSection(section);
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-10 w-full bg-muted" />
        <Skeleton className="h-48 w-full bg-muted" />
        <Skeleton className="h-32 w-full bg-muted" />
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            活动不存在
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* 头部 */}
      <div className="sticky top-0 z-20 bg-card border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <Link to="/mobile/activities">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-foreground flex-1 line-clamp-1">
            活动详情
          </h1>
          <QRCodeGenerator activityId={id!} activityName={activity.name} />
        </div>

        {/* 快速导航栏 */}
        <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto">
          <Button
            variant={activeSection === 'info' ? 'default' : 'outline'}
            size="sm"
            onClick={() => scrollToSection(infoRef, 'info')}
            className="whitespace-nowrap"
          >
            基本信息
          </Button>
          <Button
            variant={activeSection === 'fee' ? 'default' : 'outline'}
            size="sm"
            onClick={() => scrollToSection(feeRef, 'fee')}
            className="whitespace-nowrap"
          >
            人员费用
          </Button>
          <Button
            variant={activeSection === 'participants' ? 'default' : 'outline'}
            size="sm"
            onClick={() => scrollToSection(participantsRef, 'participants')}
            className="whitespace-nowrap"
          >
            参与人员
          </Button>
          {activity.notes && (
            <Button
              variant={activeSection === 'notes' ? 'default' : 'outline'}
              size="sm"
              onClick={() => scrollToSection(notesRef, 'notes')}
              className="whitespace-nowrap"
            >
              备注
            </Button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 活动基本信息 */}
        <div ref={infoRef} id="info">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{activity.name}</CardTitle>
                <Badge className={statusColors[activity.status] || 'bg-muted'}>
                  {activity.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {activity.type === '长期' ? '长期活动' : (activity.start_date || '-')}
                </span>
              </div>
              {activity.location && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{activity.location}</span>
                </div>
              )}
              {activity.content && (
                <div className="pt-2 border-t border-border">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {activity.content}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 人员和费用信息 */}
        <div ref={feeRef} id="fee">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">人员与费用</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">需求人数</span>
                <span className="font-medium">{activity.required_people || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">已报名人数</span>
                <span className={cn(
                  "font-bold",
                  activity.required_people > 0 && (activity.participant_count || 0) >= activity.required_people ? "text-chart-2" : "text-primary"
                )}>
                  {activity.participant_count || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">一手价</span>
                <span className="font-medium">
                  {activity.profit ? `¥${activity.profit}` : '-'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">兼职工资</span>
                <span className="font-medium">
                  {activity.part_time_salary ? `¥${activity.part_time_salary}` : '-'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">人头费</span>
                <span className="font-medium">
                  {activity.per_head_fee ? `¥${activity.per_head_fee}` : '-'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 参与人员列表 */}
        <div ref={participantsRef} id="participants">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  参与人员 ({participants.length})
                </CardTitle>
                <div className="flex gap-2">
                  {activity?.type === '线上' ? (
                    <Button size="sm" onClick={() => setOnlineParticipantsOpen(true)}>
                      <Users className="h-4 w-4 mr-1" />
                      管理
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" className="text-chart-2 border-chart-2" onClick={handleMarkAllPaid}>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        发薪完毕
                      </Button>
                      <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-1" />
                        添加
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {activity?.type === '线上' ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">
                    线上活动采用领队人数统计模式
                  </p>
                  <Button onClick={() => setOnlineParticipantsOpen(true)}>
                    查看领队人数统计
                  </Button>
                </div>
              ) : participants.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  暂无参与人员
                </p>
              ) : (
                <div className="space-y-2">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{participant.persons?.name || '未知'}</p>
                        <p className="text-xs text-muted-foreground">
                          {participant.persons?.contact || '-'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={participant.is_paid ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {participant.is_paid ? '已发薪' : '未发薪'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => handleEditParticipant(participant, e)}
                        >
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => handleDeleteClick(participant, e)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {activity.notes && (
          <div ref={notesRef} id="notes">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">备注</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {activity.notes}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* 添加参与人员对话框 */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>添加参与人员</DialogTitle>
          </DialogHeader>
          <SmartPersonInput
            activityId={id!}
            onSuccess={handleAddSuccess}
            onCancel={() => setAddDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* 编辑参与人员对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑参与记录</DialogTitle>
            <DialogDescription>
              {editingParticipant?.persons?.name} - {editingParticipant?.persons?.contact}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSaveEdit)} className="space-y-4">
              <FormField
                control={form.control}
                name="salary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>兼职工资</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="请输入兼职工资"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deposit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>押金</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="请输入押金"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="per_head_fee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>人头费</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="请输入人头费"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_paid"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>发薪状态</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        {field.value ? '已发薪' : '未发薪'}
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditDialogOpen(false)}
                >
                  取消
                </Button>
                <Button type="submit" className="flex-1">
                  保存
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要将 {deletingParticipant?.persons?.name} 从该活动中移除吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 线上活动参与人数管理对话框 */}
      {activity && activity.type === '线上' && (
        <OnlineActivityParticipantsDialog
          activityId={activity.id}
          activityName={activity.name}
          open={onlineParticipantsOpen}
          onOpenChange={setOnlineParticipantsOpen}
        />
      )}
    </div>
  );
}
