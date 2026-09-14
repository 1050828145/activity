import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Plus, Trash2, Edit2, Upload, Download, FileDown, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { userFriendlyMessages, formatApiError } from '@/lib/user-friendly-messages';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ActivityForm from '@/components/activities/ActivityForm';
import ActivityTable from '@/components/activities/ActivityTable';
import BatchUpdateActivityForm from '@/components/activities/BatchUpdateActivityForm';
import ActivityParticipantsDialog from '@/components/activities/ActivityParticipantsDialog';
import OnlineActivityParticipantsDialog from '@/components/activities/OnlineActivityParticipantsDialog';
import QuickSearch from '@/components/activities/QuickSearch';
import { getActivities, createActivity, updateActivity, deleteActivity, deleteActivities, updateActivities, createActivities } from '@/db/api';
import type { Activity, ActivityFormData } from '@/types';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { downloadActivityTemplate, parseActivityExcel } from '@/utils/activityExcel';
import { exportActivities } from '@/utils/exportExcel';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthCheck } from '@/hooks/use-auth-check';
import { usePageCache } from '@/hooks/use-page-cache';
import { searchActivities } from '@/lib/similarity';
import { TablePagination } from '@/components/common/TablePagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';

export default function Activities() {
  const navigate = useNavigate();
  const { checkAuth } = useAuthCheck();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [batchUpdateOpen, setBatchUpdateOpen] = useState(false);
  const [batchAddOpen, setBatchAddOpen] = useState(false);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | undefined>();
  const [uploading, setUploading] = useState(false);
  const [participantsDialogOpen, setParticipantsDialogOpen] = useState(false);
  const [selectedActivityForParticipants, setSelectedActivityForParticipants] = useState<Activity | null>(null);

  // 快速搜索状态
  const [quickSearchText, setQuickSearchText] = useState<string>('');

  // 筛选状态
  const [filterName, setFilterName] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterUnpaid, setFilterUnpaid] = useState<boolean>(false);
  const [filterUpcoming, setFilterUpcoming] = useState<boolean>(false);
  const [filterEndingSoon, setFilterEndingSoon] = useState<boolean>(false);

  // 分页状态
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // 页面缓存：保存和恢复页面状态
  const restoredState = usePageCache('activities', () => ({
    quickSearchText,
    filterName,
    filterStatus,
    filterType,
    filterStartDate,
    filterEndDate,
    filterUnpaid,
    filterUpcoming,
    filterEndingSoon,
    selectedIds,
    currentPage,
    pageSize,
  }));

  // 首次加载时恢复状态
  useEffect(() => {
    if (restoredState) {
      console.log('[Activities] 恢复页面状态', restoredState);
      setQuickSearchText(restoredState.quickSearchText || '');
      setFilterName(restoredState.filterName || '');
      setFilterStatus(restoredState.filterStatus || 'all');
      setFilterType(restoredState.filterType || 'all');
      setFilterStartDate(restoredState.filterStartDate || '');
      setFilterEndDate(restoredState.filterEndDate || '');
      setFilterUnpaid(restoredState.filterUnpaid || false);
      setFilterUpcoming(restoredState.filterUpcoming || false);
      setFilterEndingSoon(restoredState.filterEndingSoon || false);
      setSelectedIds(restoredState.selectedIds || []);
      setCurrentPage(restoredState.currentPage || 1);
      setPageSize(restoredState.pageSize || 20);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadActivities();
  }, []);

  // 应用筛选
  useEffect(() => {
    let filtered = [...activities];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);
    const threeDaysLaterStr = threeDaysLater.toISOString().split('T')[0];

    // 快速搜索优先（如果有快速搜索，只显示搜索结果，最多3个）
    if (quickSearchText.trim()) {
      const searchResults = searchActivities(activities, quickSearchText, 3); // 最多返回3个结果
      const matchedIds = searchResults.map(r => r.id);
      filtered = filtered.filter(a => matchedIds.includes(a.id));
      // 按匹配度排序
      filtered.sort((a, b) => {
        const scoreA = searchResults.find(r => r.id === a.id)?.score || 0;
        const scoreB = searchResults.find(r => r.id === b.id)?.score || 0;
        return scoreB - scoreA;
      });
    } else {
      // 活动名称筛选（模糊匹配）
      if (filterName) {
        filtered = filtered.filter(a => a.name.toLowerCase().includes(filterName.toLowerCase()));
      }

      // 活动类型筛选
      if (filterType && filterType !== 'all') {
        filtered = filtered.filter(a => {
          const typeName = a.activity_type_name || a.type || '';
          return typeName === filterType;
        });
      }

      // 状态筛选
      if (filterStatus && filterStatus !== 'all') {
        const statuses = filterStatus.split(',');
        filtered = filtered.filter(a => statuses.includes(a.status));
      }

      // 开始日期筛选
      if (filterStartDate) {
        filtered = filtered.filter(a => a.start_date && a.start_date >= filterStartDate);
      }

      // 结束日期筛选
      if (filterEndDate) {
        filtered = filtered.filter(a => a.start_date && a.start_date <= filterEndDate);
      }

      // 即将进行筛选
      if (filterUpcoming) {
        filtered = filtered.filter(a => a.start_date && a.start_date > todayStr);
      }

      // 即将结束筛选
      if (filterEndingSoon) {
        filtered = filtered.filter(a => 
          a.end_date && 
          a.end_date >= todayStr && 
          a.end_date <= threeDaysLaterStr &&
          a.status !== '已完成' &&
          a.status !== '已取消'
        );
      }
    }

    setFilteredActivities(filtered);
    // 筛选条件变化时重置到第一页
    setCurrentPage(1);
  }, [activities, quickSearchText, filterName, filterStatus, filterType, filterStartDate, filterEndDate, filterUnpaid, filterUpcoming, filterEndingSoon]);

  // 分页数据
  const paginatedActivities = filteredActivities.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(filteredActivities.length / pageSize);

  // 从URL参数初始化筛选
  useEffect(() => {
    const name = searchParams.get('name');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const unpaid = searchParams.get('unpaid');
    const upcoming = searchParams.get('upcoming');
    const endingSoon = searchParams.get('endingSoon');

    if (name) setFilterName(name);
    if (status) setFilterStatus(status);
    if (startDate) setFilterStartDate(startDate);
    if (endDate) setFilterEndDate(endDate);
    if (unpaid) setFilterUnpaid(unpaid === 'true');
    if (upcoming) setFilterUpcoming(upcoming === 'true');
    if (endingSoon) setFilterEndingSoon(endingSoon === 'true');
  }, [searchParams]);

  const clearFilters = () => {
    setFilterName('');
    setFilterStatus('all');
    setFilterType('all');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterUnpaid(false);
    setFilterUpcoming(false);
    setFilterEndingSoon(false);
    setSearchParams({});
  };

  const hasActiveFilters = filterName || (filterStatus && filterStatus !== 'all') || (filterType && filterType !== 'all') || filterStartDate || filterEndDate || filterUnpaid || filterUpcoming || filterEndingSoon;

  // 从已加载活动中提取唯一活动类型选项
  const activityTypeOptions = Array.from(
    new Set(activities.map(a => a.activity_type_name || a.type).filter(Boolean))
  ).sort((a, b) => (a as string).localeCompare(b as string, 'zh-CN'));

  const loadActivities = async () => {
    try {
      setLoading(true);
      const data = await getActivities();
      setActivities(data);
    } catch (error) {
      console.error('加载活动列表失败:', error);
      toast.error(formatApiError(error, '活动列表'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    if (!checkAuth('创建活动')) return;
    setEditingActivity(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (activity: Activity) => {
    if (!checkAuth('编辑活动')) return;
    setEditingActivity(activity);
    setDialogOpen(true);
  };

  const handleSubmit = async (data: ActivityFormData) => {
    try {
      if (editingActivity) {
        if (!checkAuth('更新活动')) return;
        await updateActivity(editingActivity.id, data);
        toast.success('活动更新成功');
      } else {
        if (!checkAuth('创建活动')) return;
        await createActivity(data);
        toast.success(userFriendlyMessages.success.created('活动'));
      }
      setDialogOpen(false);
      loadActivities();
    } catch (error) {
      console.error('保存活动失败:', error);
      const action = editingActivity ? '更新' : '创建';
      toast.error(formatApiError(error, `${action}活动`));
    }
  };

  const handleDelete = async (id: string) => {
    if (!checkAuth('删除活动')) return;
    try {
      await deleteActivity(id);
      toast.success(userFriendlyMessages.success.deleted('活动'));
      loadActivities();
    } catch (error) {
      console.error('删除活动失败:', error);
      toast.error(formatApiError(error, '删除活动'));
    }
  };

  const handleBatchDelete = async () => {
    if (!checkAuth('批量删除活动')) return;
    try {
      await deleteActivities(selectedIds);
      toast.success(`成功删除 ${selectedIds.length} 条活动`);
      setSelectedIds([]);
      setBatchDeleteOpen(false);
      loadActivities();
    } catch (error) {
      console.error('批量删除失败:', error);
      toast.error(formatApiError(error, '批量删除活动'));
    }
  };

  const handleBatchUpdate = async (updates: Partial<ActivityFormData>) => {
    if (!checkAuth('批量更新活动')) return;
    try {
      await updateActivities(selectedIds, updates);
      toast.success(`成功更新 ${selectedIds.length} 条活动`);
      setSelectedIds([]);
      setBatchUpdateOpen(false);
      loadActivities();
    } catch (error) {
      console.error('批量更新失败:', error);
      toast.error(formatApiError(error, '批量更新活动'));
    }
  };

  const handleDownloadTemplate = () => {
    try {
      downloadActivityTemplate();
      toast.success('模板下载成功');
    } catch (error) {
      console.error('下载模板失败:', error);
      toast.error('下载模板失败，请稍后重试。如果问题持续，请联系技术支持。');
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    if (!checkAuth('导入活动数据')) return;

    const file = acceptedFiles[0];
    
    try {
      setUploading(true);
      const newActivities = await parseActivityExcel(file);
      
      if (newActivities.length === 0) {
        toast.error('Excel文件中没有有效数据，请检查文件格式是否正确。\n\n💡 解决方法：请下载模板文件，按照模板格式填写数据后重新上传。');
        return;
      }

      await createActivities(newActivities);
      toast.success(`成功导入 ${newActivities.length} 条活动`);
      setBatchAddOpen(false);
      loadActivities();
    } catch (error) {
      console.error('导入失败:', error);
      const errorMsg = error instanceof Error ? error.message : '';
      if (errorMsg.includes('格式') || errorMsg.includes('解析')) {
        toast.error('文件格式不正确，无法解析。\n\n💡 解决方法：请确保使用Excel格式(.xlsx)，并按照模板格式填写数据。如需帮助，请联系技术支持。');
      } else {
        toast.error(formatApiError(error, '导入活动数据'));
      }
    } finally {
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    disabled: uploading,
  });

  const handleView = (id: string) => {
    navigate(`/activities/${id}`);
  };

  const handleManageParticipants = (activity: Activity) => {
    setSelectedActivityForParticipants(activity);
    setParticipantsDialogOpen(true);
  };

  const handleExport = () => {
    try {
      const dataToExport = selectedIds.length > 0
        ? activities.filter(a => selectedIds.includes(a.id))
        : activities;
      
      if (dataToExport.length === 0) {
        toast.error('没有可导出的数据');
        return;
      }

      exportActivities(dataToExport, `活动数据_${new Date().toLocaleDateString()}.xlsx`);
      toast.success(`成功导出 ${dataToExport.length} 条活动数据`);
    } catch (error) {
      console.error('导出失败:', error);
      toast.error('导出失败，请稍后重试。\n\n💡 可能原因：浏览器阻止了文件下载。\n\n💡 解决方法：请检查浏览器的下载设置，允许本网站下载文件。如需帮助，请联系技术支持。');
    }
  };

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
          <h1 className="text-3xl font-bold text-foreground">活动管理</h1>
          <p className="text-muted-foreground mt-2">管理所有活动信息</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <>
              <Button variant="outline" onClick={() => setBatchUpdateOpen(true)}>
                <Edit2 className="h-4 w-4 mr-2" />
                批量修改 ({selectedIds.length})
              </Button>
              <Button variant="outline" onClick={() => setBatchDeleteOpen(true)}>
                <Trash2 className="h-4 w-4 mr-2" />
                批量删除 ({selectedIds.length})
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <FileDown className="h-4 w-4 mr-2" />
                导出选中 ({selectedIds.length})
              </Button>
            </>
          )}
          {selectedIds.length === 0 && activities.length > 0 && (
            <Button variant="outline" onClick={handleExport}>
              <FileDown className="h-4 w-4 mr-2" />
              导出全部
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                新建活动
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                单个添加
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBatchAddOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                批量导入
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 快速入口 */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 p-3 rounded-lg border border-primary/20">
        <div className="flex items-center gap-2">
          <QuickSearch
            value={quickSearchText}
            onChange={setQuickSearchText}
            onClear={() => setQuickSearchText('')}
          />
          {quickSearchText && (
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              找到 {filteredActivities.length} 个
            </div>
          )}
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              筛选
              {hasActiveFilters && (
                <span className="ml-2 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">
                  {[filterName, filterStatus && filterStatus !== 'all', filterType && filterType !== 'all', filterStartDate, filterEndDate, filterUnpaid, filterUpcoming, filterEndingSoon].filter(Boolean).length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>活动名称</Label>
                <Input
                  placeholder="输入活动名称搜索..."
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>活动状态</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="全部状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="待确认">待确认</SelectItem>
                    <SelectItem value="已确认">已确认</SelectItem>
                    <SelectItem value="进行中">进行中</SelectItem>
                    <SelectItem value="已完成">已完成</SelectItem>
                    <SelectItem value="已取消">已取消</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>活动类型</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
                    <SelectValue placeholder="全部类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类型</SelectItem>
                    {activityTypeOptions.map((typeName) => (
                      <SelectItem key={typeName as string} value={typeName as string}>
                        {typeName as string}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>开始日期(从)</Label>
                <Input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>开始日期(到)</Label>
                <Input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between space-x-2 pt-2 border-t border-border mt-2">
                <Label htmlFor="upcoming" className="cursor-pointer font-normal text-sm">即将开始的活动</Label>
                <Switch 
                  id="upcoming" 
                  checked={filterUpcoming} 
                  onCheckedChange={setFilterUpcoming} 
                />
              </div>

              <div className="flex items-center justify-between space-x-2 pt-2">
                <Label htmlFor="endingSoon" className="cursor-pointer font-normal text-sm">即将结束 (3天内)</Label>
                <Switch 
                  id="endingSoon" 
                  checked={filterEndingSoon} 
                  onCheckedChange={setFilterEndingSoon} 
                />
              </div>

              <div className="flex items-center justify-between space-x-2 pt-2">
                <Label htmlFor="unpaid" className="cursor-pointer font-normal text-sm">包含待发薪</Label>
                <Switch 
                  id="unpaid" 
                  checked={filterUnpaid} 
                  onCheckedChange={setFilterUnpaid} 
                />
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-border">
                <Button variant="outline" size="sm" onClick={clearFilters} className="w-full">
                  <X className="h-4 w-4 mr-2" />
                  重置筛选
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            {filterStatus && filterStatus !== 'all' && (
              <div className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm flex items-center gap-1">
                状态: {filterStatus}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setFilterStatus('all')}
                />
              </div>
            )}
            {filterType && filterType !== 'all' && (
              <div className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm flex items-center gap-1">
                类型: {filterType}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setFilterType('all')}
                />
              </div>
            )}
            {filterStartDate && (
              <div className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm flex items-center gap-1">
                开始: {filterStartDate}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setFilterStartDate('')}
                />
              </div>
            )}
            {filterEndDate && (
              <div className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm flex items-center gap-1">
                结束: {filterEndDate}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setFilterEndDate('')}
                />
              </div>
            )}
            {filterUpcoming && (
              <div className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm flex items-center gap-1">
                即将开始
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setFilterUpcoming(false)}
                />
              </div>
            )}
            {filterEndingSoon && (
              <div className="bg-destructive/10 text-destructive border border-destructive/20 px-2 py-1 rounded-md text-sm flex items-center gap-1">
                即将结束 (3天内)
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setFilterEndingSoon(false)}
                />
              </div>
            )}
            {filterUnpaid && (
              <div className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm flex items-center gap-1">
                待发薪
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setFilterUnpaid(false)}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <ActivityTable
        activities={paginatedActivities}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
        onManageParticipants={handleManageParticipants}
      />

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filteredActivities.length}
        onPageChange={setCurrentPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setCurrentPage(1);
        }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingActivity ? '编辑活动' : '新建活动'}
            </DialogTitle>
          </DialogHeader>
          <ActivityForm
            activity={editingActivity}
            onSubmit={handleSubmit}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={batchUpdateOpen} onOpenChange={setBatchUpdateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量修改活动</DialogTitle>
          </DialogHeader>
          <BatchUpdateActivityForm
            count={selectedIds.length}
            onSubmit={handleBatchUpdate}
            onCancel={() => setBatchUpdateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={batchAddOpen} onOpenChange={setBatchAddOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>批量导入活动</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/50">
              <div>
                <p className="font-medium text-foreground">第一步: 下载Excel模板</p>
                <p className="text-sm text-muted-foreground mt-1">
                  下载模板文件,按照格式填写活动信息
                </p>
              </div>
              <Button onClick={handleDownloadTemplate} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                下载模板
              </Button>
            </div>

            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                isDragActive
                  ? 'border-primary bg-accent'
                  : 'border-border hover:border-primary hover:bg-accent',
                uploading && 'opacity-50 cursor-not-allowed'
              )}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-12 w-12 text-muted-foreground" />
                <p className="font-medium text-foreground">
                  第二步: 上传填写好的Excel文件
                </p>
                <p className="text-sm text-muted-foreground">
                  {uploading
                    ? '正在导入...'
                    : isDragActive
                    ? '释放以上传文件'
                    : '点击选择文件或拖拽文件到此处'}
                </p>
                <p className="text-xs text-muted-foreground">
                  支持 .xlsx 和 .xls 格式
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setBatchAddOpen(false)}>
                关闭
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将永久删除选中的 {selectedIds.length} 条活动及其所有参与记录,无法恢复。确定要继续吗?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedActivityForParticipants && (
        selectedActivityForParticipants.type === '线上' ? (
          <OnlineActivityParticipantsDialog
            activityId={selectedActivityForParticipants.id}
            activityName={selectedActivityForParticipants.name}
            open={participantsDialogOpen}
            onOpenChange={setParticipantsDialogOpen}
          />
        ) : (
          <ActivityParticipantsDialog
            activityId={selectedActivityForParticipants.id}
            open={participantsDialogOpen}
            onOpenChange={setParticipantsDialogOpen}
            onSuccess={loadActivities}
          />
        )
      )}
    </div>
  );
}
