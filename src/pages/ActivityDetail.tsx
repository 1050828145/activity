import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Edit, Calendar, MapPin, Users, DollarSign, Plus, Trash2, Copy, Upload, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  getActivity,
  getActivityParticipantsWithDetails,
  addActivityParticipants,
  getLeaders,
  getActivityLeaders,
  setActivityLeaders,
  updateParticipantDetails,
  deleteParticipant,
  markAllParticipantsAsPaid,
} from '@/db/api';
import type { Activity, Leader } from '@/types';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import ParticipantSelector from '@/components/common/ParticipantSelector';
import ParticipantDetailForm from '@/components/common/ParticipantDetailForm';
import LeaderSelector from '@/components/common/LeaderSelector';
import BatchImportPersonsDialog from '@/components/activities/BatchImportPersonsDialog';
import OnlineActivityParticipantsDialog from '@/components/activities/OnlineActivityParticipantsDialog';
import { useAuthCheck } from '@/hooks/use-auth-check';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { userFriendlyMessages, formatApiError } from '@/lib/user-friendly-messages';

const statusColors: Record<string, string> = {
  '待确认': 'bg-muted text-muted-foreground',
  '已确认': 'bg-primary text-primary-foreground',
  '进行中': 'bg-chart-1 text-primary-foreground',
  '已完成': 'bg-chart-2 text-primary-foreground',
  '已取消': 'bg-destructive text-destructive-foreground',
};

const participantStatusColors: Record<string, string> = {
  '待确认': 'bg-muted text-muted-foreground',
  '已确认': 'bg-primary text-primary-foreground',
  '已出席': 'bg-chart-2 text-primary-foreground',
  '已合格': 'bg-chart-1 text-primary-foreground',
  '未出席': 'bg-destructive text-destructive-foreground',
  '已取消': 'bg-destructive text-destructive-foreground',
};

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { checkAuth } = useAuthCheck();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [allLeaders, setAllLeaders] = useState<Leader[]>([]);
  const [activityLeaders, setActivityLeadersState] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<any>(null);
  const [deleteParticipantId, setDeleteParticipantId] = useState<string | null>(null);
  const [batchImportOpen, setBatchImportOpen] = useState(false);
  const [onlineParticipantsOpen, setOnlineParticipantsOpen] = useState(false);

  useEffect(() => {
    if (id) {
      loadActivityDetail();
    }
  }, [id]);

  const loadActivityDetail = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [activityData, participantsData, leadersData, activityLeadersData] = await Promise.all([
        getActivity(id),
        getActivityParticipantsWithDetails(id),
        getLeaders(),
        getActivityLeaders(id),
      ]);
      setActivity(activityData);
      setParticipants(participantsData);
      setAllLeaders(leadersData);
      setActivityLeadersState(activityLeadersData);
    } catch (error) {
      console.error('加载活动详情失败:', error);
      toast.error(formatApiError(error, '活动详情'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateParticipants = async (personIds: string[]) => {
    if (!id) return;
    if (!checkAuth('添加参与人员')) return;
    try {
      // 过滤出新添加的人员ID(不在当前参与人员列表中的)
      const currentPersonIds = participants.map(p => p.person_id);
      const newPersonIds = personIds.filter(pid => !currentPersonIds.includes(pid));
      
      if (newPersonIds.length === 0) {
        toast.info('没有新增的参与人员');
        setSelectorOpen(false);
        return;
      }

      await addActivityParticipants(id, newPersonIds);
      toast.success(`成功添加 ${newPersonIds.length} 位参与人员`);
      setSelectorOpen(false);
      loadActivityDetail();
    } catch (error) {
      console.error('添加参与人员失败:', error);
      toast.error(formatApiError(error, '添加参与人员'));
    }
  };

  const handleUpdateLeaders = async (leaders: Leader[]) => {
    if (!id) return;
    if (!checkAuth('更新领队')) return;
    try {
      await setActivityLeaders(id, leaders.map(l => l.id));
      toast.success('领队更新成功');
      loadActivityDetail();
    } catch (error) {
      console.error('更新领队失败:', error);
      toast.error(formatApiError(error, '更新领队'));
    }
  };

  const handleEditParticipant = (participant: any) => {
    if (!checkAuth('编辑参与人员信息')) return;
    setEditingParticipant(participant);
  };

  const handleUpdateParticipantDetails = async (details: any) => {
    if (!id || !editingParticipant) return;
    if (!checkAuth('保存参与信息')) return;
    try {
      await updateParticipantDetails(id, editingParticipant.person_id, {
        status: details.status,
        salary: details.salary ?? null,
        deposit: details.deposit ?? 0,
        per_head_fee: details.per_head_fee ?? null,
        introducer_id: details.introducer_id ?? null,
        is_paid: details.is_paid,
      });
      toast.success('参与信息更新成功');
      setEditingParticipant(null);
      loadActivityDetail();
    } catch (error) {
      console.error('更新参与信息失败:', error);
      toast.error(formatApiError(error, '更新参与信息'));
    }
  };

  const handleDeleteParticipant = async () => {
    if (!id || !deleteParticipantId) return;
    if (!checkAuth('删除参与人员')) return;
    try {
      const participant = participants.find(p => p.person_id === deleteParticipantId);
      if (participant) {
        await deleteParticipant(id, participant.person_id);
        toast.success('参与人员删除成功');
        setDeleteParticipantId(null);
        loadActivityDetail();
      }
    } catch (error) {
      console.error('删除参与人员失败:', error);
      toast.error(formatApiError(error, '删除参与人员'));
    }
  };

  const handleMarkAllPaid = async () => {
    if (!id) return;
    if (!checkAuth('一键发薪')) return;
    try {
      await markAllParticipantsAsPaid(id);
      toast.success('已将该活动所有参与人员状态标记为已发薪');
      loadActivityDetail();
    } catch (error) {
      console.error('一键发薪失败:', error);
      toast.error(formatApiError(error, '一键发薪'));
    }
  };

  const handleCopyActivity = async () => {
    if (!activity) return;
    
    const isLongTerm = activity.type === '长期';
    const activityText = `
活动名称: ${activity.name}
活动类型: ${activity.type || '短期'}
活动状态: ${activity.status}
${!isLongTerm ? `开始日期: ${activity.start_date ? format(new Date(activity.start_date), 'yyyy年MM月dd日', { locale: zhCN }) : '未设置'}\n` : ''}${!isLongTerm && activity.end_date ? `结束日期: ${format(new Date(activity.end_date), 'yyyy年MM月dd日', { locale: zhCN })}\n` : ''}${activity.payment_date ? `发薪日期: ${format(new Date(activity.payment_date), 'yyyy年MM月dd日', { locale: zhCN })}\n` : ''}活动地点: ${activity.location}
${activity.summary ? `活动概要: ${activity.summary}\n` : ''}${activity.content ? `活动内容: ${activity.content}\n` : ''}${activity.registration_method ? `报名方式: ${activity.registration_method}\n` : ''}需求人数: ${activity.required_people}人
${activity.requirements ? `人员要求: ${activity.requirements}\n` : ''}${activity.profit ? `利润: ¥${activity.profit}\n` : ''}${activity.part_time_salary ? `兼职工资: ¥${activity.part_time_salary}\n` : ''}${activity.per_head_fee ? `人头费: ¥${activity.per_head_fee}\n` : ''}${activity.deposit ? `押金: ¥${activity.deposit}\n` : ''}${activity.notes ? `备注: ${activity.notes}\n` : ''}
参与人数: ${participants.length}人
领队人数: ${activityLeaders.length}人
    `.trim();

    try {
      await navigator.clipboard.writeText(activityText);
      toast.success(userFriendlyMessages.success.copied('活动信息'));
    } catch (error) {
      console.error('复制失败:', error);
      toast.error(userFriendlyMessages.operation.copyFailed);
    }
  };

  const handleCopyRegistrationMethod = async () => {
    if (!activity?.registration_method) {
      toast.error(userFriendlyMessages.data.empty('报名方式'));
      return;
    }

    try {
      await navigator.clipboard.writeText(activity.registration_method);
      toast.success(userFriendlyMessages.success.copied('报名方式'));
    } catch (error) {
      console.error('复制失败:', error);
      toast.error(userFriendlyMessages.operation.copyFailed);
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

  if (!activity) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">活动不存在</p>
        <Button onClick={() => navigate('/activities')} className="mt-4">
          返回列表
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/activities')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground">{activity.name}</h1>
        </div>
        <Badge className={statusColors[activity.status] || 'bg-muted'}>
          {activity.status}
        </Badge>
        {activity.activity_type_name && (
          <Badge variant="outline">
            {activity.activity_type_name}
          </Badge>
        )}
        <Button variant="outline" onClick={handleCopyActivity}>
          <Copy className="h-4 w-4 mr-2" />
          复制活动信息
        </Button>
        <Button onClick={() => navigate(`/activities/${id}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          编辑
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>基本信息</CardTitle>
              {activity.type === '长期' && (
                <Badge variant="secondary" className="bg-chart-2 text-white">长期活动</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {activity.type !== '长期' ? (
              <>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">开始日期</p>
                    <p className="font-medium">
                      {activity.start_date ? format(new Date(activity.start_date), 'yyyy年MM月dd日', { locale: zhCN }) : '未设置'}
                    </p>
                  </div>
                </div>
                {activity.end_date && (
                  <>
                    <Separator />
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">结束日期</p>
                        <p className="font-medium">
                          {format(new Date(activity.end_date), 'yyyy年MM月dd日', { locale: zhCN })}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : null}
            {activity.payment_date && (
              <>
                <Separator />
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">发薪日期</p>
                    <p className="font-medium">
                      {format(new Date(activity.payment_date), 'yyyy年MM月dd日', { locale: zhCN })}
                    </p>
                  </div>
                </div>
              </>
            )}
            <Separator />
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">活动地点</p>
                <p className="font-medium">{activity.location}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">需求人数</p>
                <p className="font-medium">{activity.required_people}人</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">已报名人数</p>
                <p className={cn(
                  "font-bold text-lg",
                  activity.required_people > 0 && (activity.participant_count || 0) >= activity.required_people
                    ? "text-chart-2"
                    : "text-primary"
                )}>
                  {activity.participant_count || 0} 人
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>费用信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activity.profit && (
              <>
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">利润</p>
                    <p className="font-medium">¥{activity.profit}</p>
                  </div>
                </div>
                <Separator />
              </>
            )}
            {activity.part_time_salary && (
              <>
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">兼职工资</p>
                    <p className="font-medium">¥{activity.part_time_salary}</p>
                  </div>
                </div>
                <Separator />
              </>
            )}
            {activity.per_head_fee && (
              <>
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">人头费</p>
                    <p className="font-medium">¥{activity.per_head_fee}</p>
                  </div>
                </div>
                <Separator />
              </>
            )}
            {activity.deposit !== undefined && activity.deposit !== null && (
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">押金</p>
                  <p className="font-medium">¥{activity.deposit}</p>
                </div>
              </div>
            )}
            {!activity.profit && !activity.part_time_salary && !activity.per_head_fee && (
              <p className="text-sm text-muted-foreground">暂无费用信息</p>
            )}
          </CardContent>
        </Card>
      </div>

      {activity.summary && (
        <Card>
          <CardHeader>
            <CardTitle>活动概要</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground whitespace-pre-wrap">{activity.summary}</p>
          </CardContent>
        </Card>
      )}

      {activity.content && (
        <Card>
          <CardHeader>
            <CardTitle>活动内容</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground whitespace-pre-wrap">{activity.content}</p>
          </CardContent>
        </Card>
      )}

      {activity.registration_method && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>报名方式</CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleCopyRegistrationMethod}
              className="h-8"
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              复制
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-foreground whitespace-pre-wrap">{activity.registration_method}</p>
          </CardContent>
        </Card>
      )}

      {activity.requirements && (
        <Card>
          <CardHeader>
            <CardTitle>人员要求</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground whitespace-pre-wrap">{activity.requirements}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>活动领队</CardTitle>
        </CardHeader>
        <CardContent>
          <LeaderSelector
            allLeaders={allLeaders}
            selectedLeaders={activityLeaders}
            onUpdate={handleUpdateLeaders}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>参与人员 ({participants.length})</CardTitle>
          <div className="flex gap-2">
            {activity?.type === '线上' ? (
              <Button size="sm" onClick={() => setOnlineParticipantsOpen(true)}>
                <Users className="h-4 w-4 mr-2" />
                管理领队人数
              </Button>
            ) : (
              <>
                <Button size="sm" variant="outline" className="text-chart-2 border-chart-2 hover:bg-chart-2 hover:text-white" onClick={handleMarkAllPaid}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  一键发薪完毕
                </Button>
                <Button size="sm" variant="outline" onClick={() => setBatchImportOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  批量导入
                </Button>
                <Button size="sm" onClick={() => setSelectorOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  添加人员
                </Button>
              </>
            )}
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
            <p className="text-sm text-muted-foreground">暂无参与人员</p>
          ) : (
            <div className="rounded-md border border-border overflow-auto max-w-full max-h-[calc(100vh-400px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px] sticky left-0 bg-background z-10 whitespace-nowrap">姓名</TableHead>
                    <TableHead className="w-[120px] whitespace-nowrap">联系方式</TableHead>
                    <TableHead className="w-[100px] whitespace-nowrap">状态</TableHead>
                    <TableHead className="w-[100px] whitespace-nowrap">工资</TableHead>
                    <TableHead className="w-[80px] whitespace-nowrap">押金</TableHead>
                    <TableHead className="w-[100px] whitespace-nowrap">人头费</TableHead>
                    <TableHead className="min-w-[120px]">介绍人</TableHead>
                    <TableHead className="text-right w-[120px] sticky right-0 bg-background z-10 border-l border-border whitespace-nowrap">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((participant) => (
                    <TableRow key={participant.person_id}>
                      <TableCell className="sticky left-0 bg-background z-10">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={participant.persons?.photo_url} alt={participant.persons?.name} />
                            <AvatarFallback className="text-[10px]">{participant.persons?.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium whitespace-nowrap">{participant.persons?.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{participant.persons?.contact}</TableCell>
                      <TableCell>
                        <Badge className={cn("whitespace-nowrap", participantStatusColors[participant.status] || 'bg-muted')}>
                          {participant.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{participant.salary ? `¥${participant.salary}` : '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">¥{participant.deposit || 0}</TableCell>
                      <TableCell className="whitespace-nowrap">{participant.per_head_fee ? `¥${participant.per_head_fee}` : '-'}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{participant.introducer_name || '-'}</TableCell>
                      <TableCell className="text-right sticky right-0 bg-background z-10 border-l border-border">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditParticipant(participant)}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            编辑
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteParticipantId(participant.person_id)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            删除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {activity.notes && (
        <Card>
          <CardHeader>
            <CardTitle>备注</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground whitespace-pre-wrap">{activity.notes}</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>添加参与人员</DialogTitle>
          </DialogHeader>
          <ParticipantSelector
            selectedIds={participants.map(p => p.person_id)}
            onConfirm={handleUpdateParticipants}
            onCancel={() => setSelectorOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingParticipant} onOpenChange={() => setEditingParticipant(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑参与信息</DialogTitle>
          </DialogHeader>
          {editingParticipant && (
            <ParticipantDetailForm
              leaders={allLeaders}
              onSubmit={handleUpdateParticipantDetails}
              onCancel={() => setEditingParticipant(null)}
              defaultValues={{
                status: editingParticipant.status,
                salary: editingParticipant.salary,
                deposit: editingParticipant.deposit,
                per_head_fee: editingParticipant.per_head_fee,
                introducer_id: editingParticipant.introducer_id,
                is_paid: editingParticipant.is_paid,
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 批量导入人员对话框 */}
      {activity && (
        <BatchImportPersonsDialog
          activity={activity}
          open={batchImportOpen}
          onOpenChange={setBatchImportOpen}
          onSuccess={loadActivityDetail}
        />
      )}

      {/* 线上活动参与人数管理对话框 */}
      {activity && activity.type === '线上' && (
        <OnlineActivityParticipantsDialog
          activityId={activity.id}
          activityName={activity.name}
          open={onlineParticipantsOpen}
          onOpenChange={setOnlineParticipantsOpen}
        />
      )}

      {/* 删除确认对话框 */}
      <AlertDialog open={!!deleteParticipantId} onOpenChange={() => setDeleteParticipantId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将从活动中移除该参与人员,确定要继续吗?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteParticipant}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
