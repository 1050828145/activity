import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Plus, Trash2, Edit2, Upload, Download, FileDown, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import LeaderForm from '@/components/leaders/LeaderForm';
import LeaderTable from '@/components/leaders/LeaderTable';
import BatchUpdateLeaderForm from '@/components/leaders/BatchUpdateLeaderForm';
import { getLeaders, createLeader, updateLeader, deleteLeader, deleteLeaders, updateLeaders, createLeaders } from '@/db/api';
import type { Leader, LeaderFormData } from '@/types';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { downloadLeaderTemplate, parseLeaderExcel } from '@/utils/leaderExcel';
import { exportLeaders } from '@/utils/exportExcel';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthCheck } from '@/hooks/use-auth-check';
import { usePageCache } from '@/hooks/use-page-cache';
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

export default function Leaders() {
  const { checkAuth } = useAuthCheck();
  const [searchParams, setSearchParams] = useSearchParams();
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [filteredLeaders, setFilteredLeaders] = useState<Leader[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [batchUpdateOpen, setBatchUpdateOpen] = useState(false);
  const [batchAddOpen, setBatchAddOpen] = useState(false);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [editingLeader, setEditingLeader] = useState<Leader | undefined>();
  const [uploading, setUploading] = useState(false);

  // 筛选状态
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterName, setFilterName] = useState<string>('');
  const [filterContact, setFilterContact] = useState<string>('');

  // 分页状态
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // 页面缓存：保存和恢复页面状态
  const restoredState = usePageCache('leaders', () => ({
    filterStatus,
    filterName,
    filterContact,
    selectedIds,
    currentPage,
    pageSize,
  }));

  // 首次加载时恢复状态
  useEffect(() => {
    if (restoredState) {
      console.log('[Leaders] 恢复页面状态', restoredState);
      setFilterStatus(restoredState.filterStatus || 'all');
      setFilterName(restoredState.filterName || '');
      setFilterContact(restoredState.filterContact || '');
      setSelectedIds(restoredState.selectedIds || []);
      setCurrentPage(restoredState.currentPage || 1);
      setPageSize(restoredState.pageSize || 20);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadLeaders();
  }, []);

  // 应用筛选
  useEffect(() => {
    let filtered = [...leaders];

    // 状态筛选
    if (filterStatus && filterStatus !== 'all') {
      filtered = filtered.filter(l => l.status === filterStatus);
    }

    // 姓名筛选
    if (filterName) {
      filtered = filtered.filter(l => l.name.includes(filterName));
    }

    // 手机号筛选
    if (filterContact) {
      filtered = filtered.filter(l => l.contact && l.contact.includes(filterContact));
    }

    setFilteredLeaders(filtered);
    // 筛选条件变化时重置到第一页
    setCurrentPage(1);
  }, [leaders, filterStatus, filterName, filterContact]);

  // 分页数据
  const paginatedLeaders = filteredLeaders.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(filteredLeaders.length / pageSize);

  // 从URL参数初始化筛选
  useEffect(() => {
    const status = searchParams.get('status');
    const name = searchParams.get('name');

    if (status) setFilterStatus(status);
    if (name) setFilterName(name);
  }, [searchParams]);

  const clearFilters = () => {
    setFilterStatus('all');
    setFilterName('');
    setFilterContact('');
    setSearchParams({});
  };

  const hasActiveFilters = (filterStatus && filterStatus !== 'all') || filterName || filterContact;

  const loadLeaders = async () => {
    try {
      setLoading(true);
      const data = await getLeaders();
      setLeaders(data);
    } catch (error) {
      console.error('加载领队列表失败:', error);
      toast.error('加载领队列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    if (!checkAuth('创建领队')) return;
    setEditingLeader(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (leader: Leader) => {
    if (!checkAuth('编辑领队')) return;
    setEditingLeader(leader);
    setDialogOpen(true);
  };

  const handleSubmit = async (data: LeaderFormData) => {
    try {
      if (editingLeader) {
        if (!checkAuth('更新领队')) return;
        await updateLeader(editingLeader.id, data);
        toast.success('领队更新成功');
      } else {
        if (!checkAuth('创建领队')) return;
        await createLeader(data);
        toast.success('领队创建成功');
      }
      setDialogOpen(false);
      loadLeaders();
    } catch (error) {
      console.error('保存领队失败:', error);
      toast.error('保存领队失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!checkAuth('删除领队')) return;
    try {
      await deleteLeader(id);
      toast.success('领队删除成功');
      loadLeaders();
    } catch (error) {
      console.error('删除领队失败:', error);
      toast.error('删除领队失败');
    }
  };

  const handleBatchDelete = async () => {
    if (!checkAuth('批量删除领队')) return;
    try {
      await deleteLeaders(selectedIds);
      toast.success(`成功删除 ${selectedIds.length} 条领队`);
      setSelectedIds([]);
      setBatchDeleteOpen(false);
      loadLeaders();
    } catch (error) {
      console.error('批量删除失败:', error);
      toast.error('批量删除失败');
    }
  };

  const handleBatchUpdate = async (updates: Partial<LeaderFormData>) => {
    if (!checkAuth('批量更新领队')) return;
    try {
      await updateLeaders(selectedIds, updates);
      toast.success(`成功更新 ${selectedIds.length} 条领队`);
      setSelectedIds([]);
      setBatchUpdateOpen(false);
      loadLeaders();
    } catch (error) {
      console.error('批量更新失败:', error);
      toast.error('批量更新失败');
    }
  };

  const handleDownloadTemplate = () => {
    try {
      downloadLeaderTemplate();
      toast.success('模板下载成功');
    } catch (error) {
      console.error('下载模板失败:', error);
      toast.error('下载模板失败');
    }
  };

  const handleExport = () => {
    try {
      const dataToExport = selectedIds.length > 0
        ? leaders.filter(l => selectedIds.includes(l.id))
        : leaders;
      
      if (dataToExport.length === 0) {
        toast.error('没有可导出的数据');
        return;
      }

      exportLeaders(dataToExport, `领队数据_${new Date().toLocaleDateString()}.xlsx`);
      toast.success(`成功导出 ${dataToExport.length} 条领队数据`);
    } catch (error) {
      console.error('导出失败:', error);
      toast.error('导出失败');
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    if (!checkAuth('导入领队数据')) return;

    const file = acceptedFiles[0];
    
    try {
      setUploading(true);
      const newLeaders = await parseLeaderExcel(file);
      
      if (newLeaders.length === 0) {
        toast.error('Excel文件中没有有效数据');
        return;
      }

      await createLeaders(newLeaders);
      toast.success(`成功导入 ${newLeaders.length} 条领队`);
      setBatchAddOpen(false);
      loadLeaders();
    } catch (error) {
      console.error('导入失败:', error);
      toast.error(error instanceof Error ? error.message : '导入失败');
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
          <h1 className="text-3xl font-bold text-foreground">领队管理</h1>
          <p className="text-muted-foreground mt-2">管理所有领队信息</p>
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
          {selectedIds.length === 0 && leaders.length > 0 && (
            <Button variant="outline" onClick={handleExport}>
              <FileDown className="h-4 w-4 mr-2" />
              导出全部
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                新建领队
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

      {/* 筛选栏 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              筛选
              {hasActiveFilters && (
                <span className="ml-2 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">
                  {[filterStatus && filterStatus !== 'all', filterName, filterContact].filter(Boolean).length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>领队状态</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="全部状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="在职">在职</SelectItem>
                    <SelectItem value="离职">离职</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>姓名搜索</Label>
                <Input
                  placeholder="输入姓名"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>手机号搜索</Label>
                <Input
                  placeholder="输入手机号"
                  value={filterContact}
                  onChange={(e) => setFilterContact(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  清除
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            {filterStatus && (
              <div className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm flex items-center gap-1">
                状态: {filterStatus}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setFilterStatus('')}
                />
              </div>
            )}
            {filterName && (
              <div className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm flex items-center gap-1">
                姓名: {filterName}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setFilterName('')}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <LeaderTable
        leaders={paginatedLeaders}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filteredLeaders.length}
        onPageChange={setCurrentPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setCurrentPage(1);
        }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingLeader ? '编辑领队' : '新建领队'}
            </DialogTitle>
          </DialogHeader>
          <LeaderForm
            leader={editingLeader}
            onSubmit={handleSubmit}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={batchUpdateOpen} onOpenChange={setBatchUpdateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量修改领队</DialogTitle>
          </DialogHeader>
          <BatchUpdateLeaderForm
            count={selectedIds.length}
            onSubmit={handleBatchUpdate}
            onCancel={() => setBatchUpdateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={batchAddOpen} onOpenChange={setBatchAddOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>批量导入领队</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/50">
              <div>
                <p className="font-medium text-foreground">第一步: 下载Excel模板</p>
                <p className="text-sm text-muted-foreground mt-1">
                  下载模板文件,按照格式填写领队信息
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
              此操作将永久删除选中的 {selectedIds.length} 条领队,无法恢复。确定要继续吗?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
