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
import PersonForm from '@/components/persons/PersonForm';
import PersonTable from '@/components/persons/PersonTable';
import BatchUpdatePersonForm from '@/components/persons/BatchUpdatePersonForm';
import { getPersons, createPerson, updatePerson, deletePerson, deletePersons, updatePersons, createPersons } from '@/db/api';
import type { Person, PersonFormData } from '@/types';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { downloadPersonTemplate, parsePersonExcel } from '@/utils/personExcel';
import { exportPersons } from '@/utils/exportExcel';
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

export default function Persons() {
  const navigate = useNavigate();
  const { checkAuth } = useAuthCheck();
  const [searchParams, setSearchParams] = useSearchParams();
  const [persons, setPersons] = useState<Person[]>([]);
  const [filteredPersons, setFilteredPersons] = useState<Person[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [batchUpdateOpen, setBatchUpdateOpen] = useState(false);
  const [batchAddOpen, setBatchAddOpen] = useState(false);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | undefined>();
  const [uploading, setUploading] = useState(false);

  // 筛选状态
  const [filterName, setFilterName] = useState<string>('');
  const [filterContact, setFilterContact] = useState<string>('');
  const [filterGender, setFilterGender] = useState<string>('all');
  const [filterMinAge, setFilterMinAge] = useState<string>('');
  const [filterMaxAge, setFilterMaxAge] = useState<string>('');

  // 分页状态
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // 页面缓存：保存和恢复页面状态
  const restoredState = usePageCache('persons', () => ({
    filterName,
    filterContact,
    filterGender,
    filterMinAge,
    filterMaxAge,
    selectedIds,
    currentPage,
    pageSize,
  }));

  // 首次加载时恢复状态
  useEffect(() => {
    if (restoredState) {
      console.log('[Persons] 恢复页面状态', restoredState);
      setFilterName(restoredState.filterName || '');
      setFilterContact(restoredState.filterContact || '');
      setFilterGender(restoredState.filterGender || 'all');
      setFilterMinAge(restoredState.filterMinAge || '');
      setFilterMaxAge(restoredState.filterMaxAge || '');
      setSelectedIds(restoredState.selectedIds || []);
      setCurrentPage(restoredState.currentPage || 1);
      setPageSize(restoredState.pageSize || 20);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadPersons();
  }, []);

  // 应用筛选
  useEffect(() => {
    let filtered = [...persons];

    // 姓名筛选（模糊匹配）
    if (filterName) {
      filtered = filtered.filter(p => p.name.toLowerCase().includes(filterName.toLowerCase()));
    }

    // 手机号筛选（模糊匹配）
    if (filterContact) {
      filtered = filtered.filter(p => p.contact && p.contact.includes(filterContact));
    }

    // 性别筛选
    if (filterGender && filterGender !== 'all') {
      filtered = filtered.filter(p => p.gender === filterGender);
    }

    // 年龄筛选
    if (filterMinAge) {
      const minAge = parseInt(filterMinAge);
      filtered = filtered.filter(p => p.age && p.age >= minAge);
    }

    if (filterMaxAge) {
      const maxAge = parseInt(filterMaxAge);
      filtered = filtered.filter(p => p.age && p.age <= maxAge);
    }

    setFilteredPersons(filtered);
    // 筛选条件变化时重置到第一页
    setCurrentPage(1);
  }, [persons, filterName, filterContact, filterGender, filterMinAge, filterMaxAge]);

  // 分页数据
  const paginatedPersons = filteredPersons.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(filteredPersons.length / pageSize);

  // 从URL参数初始化筛选
  useEffect(() => {
    const name = searchParams.get('name');
    const gender = searchParams.get('gender');
    const minAge = searchParams.get('minAge');
    const maxAge = searchParams.get('maxAge');

    if (name) setFilterName(name);
    if (gender) setFilterGender(gender);
    if (minAge) setFilterMinAge(minAge);
    if (maxAge) setFilterMaxAge(maxAge);
  }, [searchParams]);

  const clearFilters = () => {
    setFilterName('');
    setFilterContact('');
    setFilterGender('all');
    setFilterMinAge('');
    setFilterMaxAge('');
    setSearchParams({});
  };

  const hasActiveFilters = filterName || filterContact || (filterGender && filterGender !== 'all') || filterMinAge || filterMaxAge;

  const loadPersons = async () => {
    try {
      setLoading(true);
      const data = await getPersons();
      setPersons(data);
    } catch (error) {
      console.error('加载人员列表失败:', error);
      toast.error(formatApiError(error, '人员列表'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    if (!checkAuth('添加人员')) return;
    setEditingPerson(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (person: Person) => {
    if (!checkAuth('编辑人员')) return;
    setEditingPerson(person);
    setDialogOpen(true);
  };

  const handleSubmit = async (data: PersonFormData) => {
    try {
      if (editingPerson) {
        if (!checkAuth('更新人员')) return;
        await updatePerson(editingPerson.id, data);
        toast.success('人员更新成功');
      } else {
        if (!checkAuth('创建人员')) return;
        await createPerson(data);
        toast.success('人员创建成功');
      }
      setDialogOpen(false);
      loadPersons();
    } catch (error) {
      console.error('保存人员失败:', error);
      toast.error(formatApiError(error, editingPerson ? '更新人员' : '创建人员'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!checkAuth('删除人员')) return;
    try {
      await deletePerson(id);
      toast.success('人员删除成功');
      loadPersons();
    } catch (error) {
      console.error('删除人员失败:', error);
      toast.error(formatApiError(error, '删除人员'));
    }
  };

  const handleBatchDelete = async () => {
    if (!checkAuth('批量删除人员')) return;
    try {
      await deletePersons(selectedIds);
      toast.success(`成功删除 ${selectedIds.length} 条人员`);
      setSelectedIds([]);
      setBatchDeleteOpen(false);
      loadPersons();
    } catch (error) {
      console.error('批量删除失败:', error);
      toast.error(formatApiError(error, '批量删除人员'));
    }
  };

  const handleBatchUpdate = async (updates: Partial<PersonFormData>) => {
    if (!checkAuth('批量更新人员')) return;
    try {
      await updatePersons(selectedIds, updates);
      toast.success(`成功更新 ${selectedIds.length} 条人员`);
      setSelectedIds([]);
      setBatchUpdateOpen(false);
      loadPersons();
    } catch (error) {
      console.error('批量更新失败:', error);
      toast.error(formatApiError(error, '批量更新人员'));
    }
  };

  const handleDownloadTemplate = () => {
    try {
      downloadPersonTemplate();
      toast.success('模板下载成功');
    } catch (error) {
      console.error('下载模板失败:', error);
      toast.error('下载模板失败');
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    if (!checkAuth('导入人员数据')) return;

    const file = acceptedFiles[0];
    
    try {
      setUploading(true);
      const newPersons = await parsePersonExcel(file);
      
      if (newPersons.length === 0) {
        toast.error('Excel文件中没有有效数据');
        return;
      }

      await createPersons(newPersons);
      toast.success(`成功导入 ${newPersons.length} 条人员`);
      setBatchAddOpen(false);
      loadPersons();
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

  const handleView = (id: string) => {
    navigate(`/persons/${id}`);
  };

  const handleExport = () => {
    try {
      const dataToExport = selectedIds.length > 0
        ? persons.filter(p => selectedIds.includes(p.id))
        : persons;
      
      if (dataToExport.length === 0) {
        toast.error('没有可导出的数据');
        return;
      }

      exportPersons(dataToExport, `人员数据_${new Date().toLocaleDateString()}.xlsx`);
      toast.success(`成功导出 ${dataToExport.length} 条人员数据`);
    } catch (error) {
      console.error('导出失败:', error);
      toast.error('导出失败');
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
          <h1 className="text-3xl font-bold text-foreground">人员管理</h1>
          <p className="text-muted-foreground mt-2">管理所有人员信息</p>
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
          {selectedIds.length === 0 && persons.length > 0 && (
            <Button variant="outline" onClick={handleExport}>
              <FileDown className="h-4 w-4 mr-2" />
              导出全部
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                新建人员
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
                  {[filterName, filterContact, filterGender && filterGender !== 'all', filterMinAge, filterMaxAge].filter(Boolean).length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>姓名</Label>
                <Input
                  placeholder="输入姓名搜索..."
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
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
                <Label>性别</Label>
                <Select value={filterGender} onValueChange={setFilterGender}>
                  <SelectTrigger>
                    <SelectValue placeholder="全部性别" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部性别</SelectItem>
                    <SelectItem value="男">男</SelectItem>
                    <SelectItem value="女">女</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>最小年龄</Label>
                <Input
                  type="number"
                  placeholder="最小年龄"
                  value={filterMinAge}
                  onChange={(e) => setFilterMinAge(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>最大年龄</Label>
                <Input
                  type="number"
                  placeholder="最大年龄"
                  value={filterMaxAge}
                  onChange={(e) => setFilterMaxAge(e.target.value)}
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
            {filterGender && (
              <div className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm flex items-center gap-1">
                性别: {filterGender}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setFilterGender('')}
                />
              </div>
            )}
            {filterMinAge && (
              <div className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm flex items-center gap-1">
                最小年龄: {filterMinAge}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setFilterMinAge('')}
                />
              </div>
            )}
            {filterMaxAge && (
              <div className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm flex items-center gap-1">
                最大年龄: {filterMaxAge}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setFilterMaxAge('')}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <PersonTable
        persons={paginatedPersons}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
      />

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filteredPersons.length}
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
              {editingPerson ? '编辑人员' : '新建人员'}
            </DialogTitle>
          </DialogHeader>
          <PersonForm
            person={editingPerson}
            onSubmit={handleSubmit}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={batchUpdateOpen} onOpenChange={setBatchUpdateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量修改人员</DialogTitle>
          </DialogHeader>
          <BatchUpdatePersonForm
            count={selectedIds.length}
            onSubmit={handleBatchUpdate}
            onCancel={() => setBatchUpdateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={batchAddOpen} onOpenChange={setBatchAddOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>批量导入人员</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/50">
              <div>
                <p className="font-medium text-foreground">第一步: 下载Excel模板</p>
                <p className="text-sm text-muted-foreground mt-1">
                  下载模板文件,按照格式填写人员信息
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
              此操作将永久删除选中的 {selectedIds.length} 条人员及其所有参与记录,无法恢复。确定要继续吗?
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
