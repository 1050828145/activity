import { useEffect, useState, useCallback } from 'react';
import { Edit, Trash2, Plus, Upload, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  getActivity,
  getActivityParticipantsWithDetails,
  addActivityParticipants,
  getLeaders,
  updateParticipantDetails,
  deleteParticipant,
  markAllParticipantsAsPaid,
} from '@/db/api';
import type { Activity, Leader } from '@/types';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ParticipantSelector from '@/components/common/ParticipantSelector';
import ParticipantDetailForm from '@/components/common/ParticipantDetailForm';
import BatchImportPersonsDialog from '@/components/activities/BatchImportPersonsDialog';
import { useAuthCheck } from '@/hooks/use-auth-check';
import { usePageCache } from '@/hooks/use-page-cache';
import { TablePagination } from '@/components/common/TablePagination';
import { cn } from '@/lib/utils';

interface ActivityParticipantsDialogProps {
  activityId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const participantStatusColors: Record<string, string> = {
  '待确认': 'bg-muted text-muted-foreground',
  '已确认': 'bg-primary text-primary-foreground',
  '已出席': 'bg-chart-2 text-primary-foreground',
  '未出席': 'bg-destructive text-destructive-foreground',
  '已取消': 'bg-destructive text-destructive-foreground',
};

export default function ActivityParticipantsDialog({
  activityId,
  open,
  onOpenChange,
  onSuccess
}: ActivityParticipantsDialogProps) {
  const { checkAuth } = useAuthCheck();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [allLeaders, setAllLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<any>(null);
  const [deleteParticipantId, setDeleteParticipantId] = useState<string | null>(null);
  const [batchImportOpen, setBatchImportOpen] = useState(false);

  // 分页状态
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // 页面缓存：保存和恢复页面状态
  const restoredState = usePageCache(`participants_${activityId}`, () => ({
    currentPage,
    pageSize,
  }));

  // 首次加载时恢复状态
  useEffect(() => {
    if (restoredState) {
      console.log('[ActivityParticipants] 恢复页面状态', restoredState);
      setCurrentPage(restoredState.currentPage || 1);
      setPageSize(restoredState.pageSize || 20);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 分页数据
  const paginatedParticipants = participants.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(participants.length / pageSize);

  const loadData = useCallback(async () => {
    if (!activityId) return;
    try {
      setLoading(true);
      const [activityData, participantsData, leadersData] = await Promise.all([
        getActivity(activityId),
        getActivityParticipantsWithDetails(activityId),
        getLeaders(),
      ]);
      setActivity(activityData);
      setParticipants(participantsData);
      setAllLeaders(leadersData);
    } catch (error) {
      console.error('加载活动参与人员失败:', error);
      toast.error('加载活动参与人员失败');
    } finally {
      setLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    if (open && activityId) {
      loadData();
    }
  }, [open, activityId, loadData]);

  const handleUpdateParticipants = async (personIds: string[]) => {
    if (!activityId) return;
    if (!checkAuth('添加参与人员')) return;
    try {
      const currentPersonIds = participants.map(p => p.person_id);
      const newPersonIds = personIds.filter(pid => !currentPersonIds.includes(pid));
      
      if (newPersonIds.length === 0) {
        toast.info('没有新增的参与人员');
        setSelectorOpen(false);
        return;
      }

      await addActivityParticipants(activityId, newPersonIds);
      toast.success(`成功添加 ${newPersonIds.length} 位参与人员`);
      setSelectorOpen(false);
      loadData();
      onSuccess?.();
    } catch (error) {
      console.error('添加参与人员失败:', error);
      toast.error('添加参与人员失败');
    }
  };

  const handleEditParticipant = (participant: any) => {
    if (!checkAuth('编辑参与人员信息')) return;
    setEditingParticipant(participant);
  };

  const handleUpdateParticipantDetails = async (details: any) => {
    if (!activityId || !editingParticipant) return;
    if (!checkAuth('保存参与信息')) return;
    try {
      await updateParticipantDetails(activityId, editingParticipant.person_id, {
        status: details.status,
        salary: details.salary ?? null,
        deposit: details.deposit ?? 0,
        per_head_fee: details.per_head_fee ?? null,
        introducer_id: details.introducer_id ?? null,
        is_paid: details.is_paid,
      });
      toast.success('参与信息更新成功');
      setEditingParticipant(null);
      loadData();
    } catch (error) {
      console.error('更新参与信息失败:', error);
      toast.error('更新参与信息失败');
    }
  };

  const handleDeleteParticipant = async () => {
    if (!activityId || !deleteParticipantId) return;
    if (!checkAuth('删除参与人员')) return;
    try {
      await deleteParticipant(activityId, deleteParticipantId);
      toast.success('参与人员删除成功');
      setDeleteParticipantId(null);
      loadData();
      onSuccess?.();
    } catch (error) {
      console.error('删除参与人员失败:', error);
      toast.error('删除参与人员失败');
    }
  };

  const handleMarkAllPaid = async () => {
    if (!activityId) return;
    if (!checkAuth('一键发薪')) return;
    try {
      await markAllParticipantsAsPaid(activityId);
      toast.success('已将该活动所有参与人员状态标记为已发薪');
      loadData();
    } catch (error) {
      console.error('一键发薪失败:', error);
      toast.error('一键发薪失败');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[70vw] w-[70vw] sm:max-w-[70vw] md:max-w-[70vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            参与人员管理 - {activity?.name || '加载中...'}
            {activity && (
              <Badge variant="outline" className="ml-2">
                需求: {activity.required_people}人 / 已报: {participants.length}人
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">
              参与人员列表 ({participants.length})
            </h3>
            <div className="flex gap-2">
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
            </div>
          </div>

          <div className="flex-1 overflow-auto border border-border rounded-md">
            {loading ? (
              <div className="p-8 space-y-4">
                <Skeleton className="h-8 w-full bg-muted" />
                <Skeleton className="h-8 w-full bg-muted" />
                <Skeleton className="h-8 w-full bg-muted" />
              </div>
            ) : participants.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                暂无参与人员数据
              </div>
            ) : (
              <>
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
                  {paginatedParticipants.map((participant) => (
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

              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={participants.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setCurrentPage(1);
                }}
              />
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </div>

        {/* 子弹窗逻辑 */}
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

        {activity && (
          <BatchImportPersonsDialog
            activity={activity}
            open={batchImportOpen}
            onOpenChange={setBatchImportOpen}
            onSuccess={loadData}
          />
        )}

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
      </DialogContent>
    </Dialog>
  );
}
