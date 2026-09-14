import { useEffect, useState } from 'react';
import { FileDown, Trash2, Filter, X, Edit2, Upload, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getAllParticipantsWithDetails, deleteParticipants, getLeaders, batchUpdateParticipantStatus, updateParticipantDetails, getActivities, getPersons, updateParticipantAddedAt } from '@/db/api';
import { exportParticipants } from '@/utils/exportExcel';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import UpdateStatusDialog from '@/components/participations/UpdateStatusDialog';
import ParticipantDetailForm from '@/components/common/ParticipantDetailForm';
import type { Leader } from '@/types';
import { useAuthCheck } from '@/hooks/use-auth-check';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

const statusColors: Record<string, string> = {
  '待确认': 'bg-muted text-muted-foreground',
  '已确认': 'bg-primary text-primary-foreground',
  '已出席': 'bg-chart-2 text-primary-foreground',
  '已合格': 'bg-chart-1 text-primary-foreground',
  '未出席': 'bg-destructive text-destructive-foreground',
  '已取消': 'bg-destructive text-destructive-foreground',
};

export default function Participations() {
  const { checkAuth } = useAuthCheck();
  const [participants, setParticipants] = useState<any[]>([]);
  const [filteredParticipants, setFilteredParticipants] = useState<any[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [updateStatusOpen, setUpdateStatusOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<any>(null);
  const [viewingParticipant, setViewingParticipant] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [editAddedTimeDialogOpen, setEditAddedTimeDialogOpen] = useState(false);
  const [editingAddedTimeParticipant, setEditingAddedTimeParticipant] = useState<any>(null);
  const [newAddedTime, setNewAddedTime] = useState('');

  // 筛选条件
  const [filterPersonName, setFilterPersonName] = useState('');
  const [filterContact, setFilterContact] = useState('');
  const [filterIntroducerId, setFilterIntroducerId] = useState('');
  const [filterActivityName, setFilterActivityName] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterIsPaid, setFilterIsPaid] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [participants, filterPersonName, filterContact, filterIntroducerId, filterActivityName, filterStatus, filterIsPaid, filterStartDate, filterEndDate]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [participantsData, leadersData] = await Promise.all([
        getAllParticipantsWithDetails(),
        getLeaders(),
      ]);
      setParticipants(participantsData);
      setLeaders(leadersData);
    } catch (error) {
      console.error('加载数据失败:', error);
      toast.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...participants];

    // 按人员姓名筛选
    if (filterPersonName) {
      filtered = filtered.filter(p =>
        p.person_name?.toLowerCase().includes(filterPersonName.toLowerCase())
      );
    }

    // 按手机号筛选
    if (filterContact) {
      filtered = filtered.filter(p =>
        p.contact?.includes(filterContact)
      );
    }

    // 按介绍人筛选
    if (filterIntroducerId && filterIntroducerId !== 'all') {
      filtered = filtered.filter(p => p.introducer_id === filterIntroducerId);
    }

    // 按活动名称筛选
    if (filterActivityName) {
      filtered = filtered.filter(p =>
        p.activity_name?.toLowerCase().includes(filterActivityName.toLowerCase())
      );
    }

    // 按参与状态筛选
    if (filterStatus && filterStatus !== 'all') {
      filtered = filtered.filter(p => p.status === filterStatus);
    }

    // 按发薪状态筛选
    if (filterIsPaid && filterIsPaid !== 'all') {
      const isPaidValue = filterIsPaid === 'true';
      filtered = filtered.filter(p => p.is_paid === isPaidValue);
    }

    // 按报名时间范围筛选
    if (filterStartDate) {
      filtered = filtered.filter(p => {
        if (!p.created_at) return false;
        const createdDate = new Date(p.created_at);
        const startDate = new Date(filterStartDate);
        startDate.setHours(0, 0, 0, 0);
        return createdDate >= startDate;
      });
    }

    if (filterEndDate) {
      filtered = filtered.filter(p => {
        if (!p.created_at) return false;
        const createdDate = new Date(p.created_at);
        const endDate = new Date(filterEndDate);
        endDate.setHours(23, 59, 59, 999);
        return createdDate <= endDate;
      });
    }

    setFilteredParticipants(filtered);
  };

  const clearFilters = () => {
    setFilterPersonName('');
    setFilterContact('');
    setFilterIntroducerId('');
    setFilterActivityName('');
    setFilterStatus('');
    setFilterIsPaid('');
    setFilterStartDate('');
    setFilterEndDate('');
  };

  const hasActiveFilters = filterPersonName || filterContact || filterIntroducerId || filterActivityName || filterStatus || filterIsPaid || filterStartDate || filterEndDate;

  // 下载模板
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        '姓名': '张三',
        '电话': '13800138000',
        '活动名称': '示例活动',
        '添加时间': '2026-01-29 14:30'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '参与人员模板');
    
    // 设置列宽
    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 20 },
      { wch: 30 },
      { wch: 20 }
    ];

    // 添加提示信息
    XLSX.utils.sheet_add_aoa(worksheet, [['提示：这是样例数据，提交前请删除此行']], { origin: 'A2' });

    XLSX.writeFile(workbook, '参与人员批量导入模板.xlsx');
    toast.success('模板下载成功');
  };

  // 批量导入
  const handleBatchImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!checkAuth('批量导入')) return;
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (jsonData.length === 0) {
        toast.error('Excel 文件为空');
        return;
      }

      // 获取所有活动和人员数据
      const [activities, persons] = await Promise.all([
        getActivities(),
        getPersons()
      ]);

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const row of jsonData) {
        try {
          const name = row['姓名']?.toString().trim();
          const contact = row['电话']?.toString().trim();
          const activityName = row['活动名称']?.toString().trim();
          const addedAtStr = row['添加时间']?.toString().trim();

          // 跳过样例数据行
          if (name === '张三' && contact === '13800138000') {
            continue;
          }

          if (!name || !contact || !activityName) {
            errors.push(`第 ${jsonData.indexOf(row) + 1} 行：姓名、电话、活动名称不能为空`);
            errorCount++;
            continue;
          }

          // 查找人员
          const person = persons.find(p => p.name === name && p.contact === contact);
          if (!person) {
            errors.push(`第 ${jsonData.indexOf(row) + 1} 行：未找到人员 ${name}（${contact}）`);
            errorCount++;
            continue;
          }

          // 查找活动
          const activity = activities.find(a => a.name === activityName);
          if (!activity) {
            errors.push(`第 ${jsonData.indexOf(row) + 1} 行：未找到活动 ${activityName}`);
            errorCount++;
            continue;
          }

          // 解析添加时间
          let addedAt = new Date();
          if (addedAtStr) {
            const parsed = new Date(addedAtStr);
            if (!isNaN(parsed.getTime())) {
              addedAt = parsed;
            }
          }

          // 更新参与人员的添加时间
          await updateParticipantDetails(activity.id, person.id, {
            added_at: addedAt.toISOString()
          });

          successCount++;
        } catch (err: any) {
          errors.push(`第 ${jsonData.indexOf(row) + 1} 行：${err.message}`);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`成功导入 ${successCount} 条记录${errorCount > 0 ? `，失败 ${errorCount} 条` : ''}`);
        loadData();
      } else {
        toast.error('导入失败');
      }

      if (errors.length > 0 && errors.length <= 5) {
        errors.forEach(err => toast.error(err));
      } else if (errors.length > 5) {
        toast.error(`共 ${errors.length} 条错误，请检查数据格式`);
      }
    } catch (error) {
      console.error('批量导入失败:', error);
      toast.error('批量导入失败');
    }

    // 重置文件输入
    e.target.value = '';
  };

  const handleExport = () => {
    try {
      const dataToExport = selectedIds.length > 0
        ? filteredParticipants.filter(p => selectedIds.includes(p.id))
        : filteredParticipants;
      
      if (dataToExport.length === 0) {
        toast.error('没有可导出的数据');
        return;
      }

      exportParticipants(dataToExport, `参与人员_${new Date().toLocaleDateString()}.xlsx`);
      toast.success(`成功导出 ${dataToExport.length} 条参与人员数据`);
    } catch (error) {
      console.error('导出失败:', error);
      toast.error('导出失败');
    }
  };

  const handleBatchDelete = async () => {
    if (!checkAuth('删除数据')) return;
    try {
      await deleteParticipants(selectedIds);
      toast.success(`成功删除 ${selectedIds.length} 条参与人员数据`);
      setSelectedIds([]);
      setDeleteOpen(false);
      loadData();
    } catch (error) {
      console.error('批量删除失败:', error);
      toast.error('批量删除失败');
    }
  };

  const handleUpdateStatus = (participant: any) => {
    if (!checkAuth('更新状态')) return;
    setEditingParticipant(participant);
    setUpdateStatusOpen(true);
  };

  const handleBatchUpdateStatus = () => {
    if (!checkAuth('批量更新状态')) return;
    setEditingParticipant(null);
    setUpdateStatusOpen(true);
  };

  const handleConfirmUpdateStatus = async (status: string) => {
    try {
      if (editingParticipant) {
        // 单个修改
        if (!checkAuth('更新状态')) return;
        await batchUpdateParticipantStatus([editingParticipant.id], status);
        toast.success('参与状态更新成功');
      } else {
        // 批量修改
        if (!checkAuth('批量更新状态')) return;
        await batchUpdateParticipantStatus(selectedIds, status);
        toast.success(`成功更新 ${selectedIds.length} 条参与人员的状态`);
        setSelectedIds([]);
      }
      setUpdateStatusOpen(false);
      setEditingParticipant(null);
      loadData();
    } catch (error) {
      console.error('更新状态失败:', error);
      toast.error('更新状态失败');
    }
  };

  const handleEdit = (participant: any) => {
    if (!checkAuth('编辑详情')) return;
    setEditingParticipant(participant);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async (data: any) => {
    if (!checkAuth('保存详情')) return;
    try {
      await updateParticipantDetails(
        editingParticipant.activity_id,
        editingParticipant.person_id,
        {
          status: data.status,
          salary: data.salary || null,
          deposit: data.deposit || 0,
          per_head_fee: data.per_head_fee || null,
          introducer_id: data.introducer_id || null,
          is_paid: data.is_paid,
          added_at: data.added_at,
        }
      );
      toast.success('参与人员信息更新成功');
      setEditDialogOpen(false);
      setEditingParticipant(null);
      loadData();
    } catch (error) {
      console.error('更新失败:', error);
      toast.error('更新失败');
    }
  };

  const handleViewDetail = (participant: any) => {
    setViewingParticipant(participant);
    setDetailDialogOpen(true);
  };

  const handleEditAddedTime = (participant: any) => {
    if (!checkAuth('修改添加时间')) return;
    setEditingAddedTimeParticipant(participant);
    setNewAddedTime(
      participant.added_at 
        ? new Date(participant.added_at).toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16)
    );
    setEditAddedTimeDialogOpen(true);
  };

  const handleSaveAddedTime = async () => {
    if (!checkAuth('保存添加时间')) return;
    try {
      await updateParticipantAddedAt(
        editingAddedTimeParticipant.id,
        new Date(newAddedTime).toISOString()
      );
      toast.success('添加时间更新成功');
      setEditAddedTimeDialogOpen(false);
      setEditingAddedTimeParticipant(null);
      loadData();
    } catch (error) {
      console.error('更新添加时间失败:', error);
      toast.error('更新添加时间失败');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredParticipants.map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    }
  };

  const isAllSelected = filteredParticipants.length > 0 && selectedIds.length === filteredParticipants.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < filteredParticipants.length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <Skeleton className="h-9 w-32 bg-muted" />
            <Skeleton className="h-5 w-48 mt-2 bg-muted" />
          </div>
          <Skeleton className="h-10 w-24 bg-muted" />
        </div>
        <Skeleton className="h-96 bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">参与人员</h1>
          <p className="text-muted-foreground mt-2">
            查看和管理所有活动参与人员 
            {hasActiveFilters && ` (已筛选: ${filteredParticipants.length}/${participants.length})`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            下载模板
          </Button>
          <Button variant="outline" asChild>
            <label htmlFor="batch-import-file" className="cursor-pointer">
              <Upload className="h-4 w-4 mr-2" />
              批量导入
              <input
                id="batch-import-file"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleBatchImport}
              />
            </label>
          </Button>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            筛选
          </Button>
          {selectedIds.length > 0 && (
            <>
              <Button variant="outline" onClick={handleBatchUpdateStatus}>
                <Edit2 className="h-4 w-4 mr-2" />
                批量修改状态 ({selectedIds.length})
              </Button>
              <Button variant="outline" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4 mr-2" />
                批量删除 ({selectedIds.length})
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <FileDown className="h-4 w-4 mr-2" />
                导出选中 ({selectedIds.length})
              </Button>
            </>
          )}
          {selectedIds.length === 0 && filteredParticipants.length > 0 && (
            <Button variant="outline" onClick={handleExport}>
              <FileDown className="h-4 w-4 mr-2" />
              导出全部
            </Button>
          )}
        </div>
      </div>

      {/* 筛选器面板 */}
      {showFilters && (
        <div className="p-4 border border-border rounded-lg bg-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">筛选条件</h3>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                清除筛选
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>人员姓名</Label>
              <Input
                placeholder="输入人员姓名搜索..."
                value={filterPersonName}
                onChange={(e) => setFilterPersonName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>手机号</Label>
              <Input
                placeholder="输入手机号搜索..."
                value={filterContact}
                onChange={(e) => setFilterContact(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>介绍人(领队)</Label>
              <Select value={filterIntroducerId} onValueChange={setFilterIntroducerId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择介绍人" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {leaders.map((leader) => (
                    <SelectItem key={leader.id} value={leader.id}>
                      {leader.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>活动名称</Label>
              <Input
                placeholder="输入活动名称搜索..."
                value={filterActivityName}
                onChange={(e) => setFilterActivityName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>参与状态</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="选择参与状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="待确认">待确认</SelectItem>
                  <SelectItem value="已确认">已确认</SelectItem>
                  <SelectItem value="已出席">已出席</SelectItem>
                  <SelectItem value="已合格">已合格</SelectItem>
                  <SelectItem value="未出席">未出席</SelectItem>
                  <SelectItem value="已取消">已取消</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>发薪状态</Label>
              <Select value={filterIsPaid} onValueChange={setFilterIsPaid}>
                <SelectTrigger>
                  <SelectValue placeholder="选择发薪状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="true">已发薪</SelectItem>
                  <SelectItem value="false">未发薪</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>报名开始日期</Label>
              <Input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                placeholder="选择开始日期"
              />
            </div>
            <div className="space-y-2">
              <Label>报名结束日期</Label>
              <Input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                placeholder="选择结束日期"
              />
            </div>
          </div>
        </div>
      )}

      <div className="rounded-md border border-border overflow-auto max-h-[calc(100vh-280px)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="全选"
                  className={isSomeSelected ? 'data-[state=checked]:bg-primary' : ''}
                />
              </TableHead>
              <TableHead>活动名称</TableHead>
              <TableHead>活动日期</TableHead>
              <TableHead>人员姓名</TableHead>
              <TableHead>联系方式</TableHead>
              <TableHead>添加时间</TableHead>
              <TableHead>参与状态</TableHead>
              <TableHead>工资</TableHead>
              <TableHead>押金</TableHead>
              <TableHead>人头费</TableHead>
              <TableHead>介绍人</TableHead>
              <TableHead>发薪状态</TableHead>
              <TableHead>备注</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredParticipants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center text-muted-foreground py-8">
                  {hasActiveFilters ? '没有符合筛选条件的记录' : '暂无参与人员'}
                </TableCell>
              </TableRow>
            ) : (
              filteredParticipants.map((participant) => (
                <TableRow key={participant.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(participant.id)}
                      onCheckedChange={(checked) => handleSelectOne(participant.id, checked as boolean)}
                      aria-label={`选择 ${participant.person_name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{participant.activity_name}</TableCell>
                  <TableCell>{participant.activity_date}</TableCell>
                  <TableCell>{participant.person_name}</TableCell>
                  <TableCell>{participant.contact}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>{participant.added_at ? format(new Date(participant.added_at), 'yyyy-MM-dd HH:mm') : '-'}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() => handleEditAddedTime(participant)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[participant.status] || 'bg-muted'}>
                      {participant.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{participant.salary ? `¥${participant.salary}` : '-'}</TableCell>
                  <TableCell>¥{participant.deposit || 0}</TableCell>
                  <TableCell>{participant.per_head_fee ? `¥${participant.per_head_fee}` : '-'}</TableCell>
                  <TableCell>{participant.introducer_name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={participant.is_paid ? 'default' : 'secondary'}>
                      {participant.is_paid ? '已发薪' : '未发薪'}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate" title={participant.notes || '-'}>
                    {participant.notes || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetail(participant)}
                      >
                        详情
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(participant)}
                      >
                        <Edit2 className="h-3 w-3 mr-1" />
                        编辑
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将永久删除选中的 {selectedIds.length} 条参与人员数据,无法恢复。确定要继续吗?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UpdateStatusDialog
        open={updateStatusOpen}
        onOpenChange={setUpdateStatusOpen}
        onConfirm={handleConfirmUpdateStatus}
        count={editingParticipant ? 1 : selectedIds.length}
        currentStatus={editingParticipant?.status}
      />

      {/* 编辑参与人员对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑参与人员</DialogTitle>
          </DialogHeader>
          {editingParticipant && (
            <ParticipantDetailForm
              onSubmit={handleSaveEdit}
              onCancel={() => {
                setEditDialogOpen(false);
                setEditingParticipant(null);
              }}
              leaders={leaders}
              defaultValues={{
                status: editingParticipant.status,
                salary: editingParticipant.salary,
                deposit: editingParticipant.deposit,
                per_head_fee: editingParticipant.per_head_fee,
                introducer_id: editingParticipant.introducer_id,
                is_paid: editingParticipant.is_paid,
                added_at: editingParticipant.added_at,
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 详情对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>参与人员详情</DialogTitle>
          </DialogHeader>
          {viewingParticipant && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">活动名称</Label>
                  <p className="font-medium">{viewingParticipant.activity_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">活动日期</Label>
                  <p className="font-medium">{viewingParticipant.activity_date}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">人员姓名</Label>
                  <p className="font-medium">{viewingParticipant.person_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">联系方式</Label>
                  <p className="font-medium">{viewingParticipant.contact}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">参与状态</Label>
                  <div className="mt-1">
                    <Badge className={statusColors[viewingParticipant.status] || 'bg-muted'}>
                      {viewingParticipant.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">发薪状态</Label>
                  <div className="mt-1">
                    <Badge variant={viewingParticipant.is_paid ? 'default' : 'secondary'}>
                      {viewingParticipant.is_paid ? '已发薪' : '未发薪'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">工资</Label>
                  <p className="font-medium">{viewingParticipant.salary ? `¥${viewingParticipant.salary}` : '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">押金</Label>
                  <p className="font-medium">¥{viewingParticipant.deposit || 0}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">人头费</Label>
                  <p className="font-medium">{viewingParticipant.per_head_fee ? `¥${viewingParticipant.per_head_fee}` : '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">介绍人</Label>
                  <p className="font-medium">{viewingParticipant.introducer_name || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">添加时间</Label>
                  <p className="font-medium">
                    {viewingParticipant.added_at ? format(new Date(viewingParticipant.added_at), 'yyyy-MM-dd HH:mm') : '-'}
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">备注</Label>
                <p className="font-medium mt-1 whitespace-pre-wrap">{viewingParticipant.notes || '-'}</p>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
                  关闭
                </Button>
                <Button onClick={() => {
                  setDetailDialogOpen(false);
                  handleEdit(viewingParticipant);
                }}>
                  编辑
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 修改添加时间对话框 */}
      <Dialog open={editAddedTimeDialogOpen} onOpenChange={setEditAddedTimeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改添加时间</DialogTitle>
          </DialogHeader>
          {editingAddedTimeParticipant && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>人员信息</Label>
                <p className="text-sm text-muted-foreground">
                  {editingAddedTimeParticipant.person_name} - {editingAddedTimeParticipant.activity_name}
                </p>
              </div>
              <div className="space-y-2">
                <Label>添加时间 *</Label>
                <Input
                  type="datetime-local"
                  value={newAddedTime}
                  onChange={(e) => setNewAddedTime(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditAddedTimeDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleSaveAddedTime}>
                  保存
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
