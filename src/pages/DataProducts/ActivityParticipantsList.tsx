import { useEffect, useState } from 'react';
import { FileDown, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { getActivities, getActivityParticipantsWithDetails } from '@/db/api';
import type { Activity } from '@/types';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { NotificationConfig } from '@/components/common/NotificationConfig';

interface ColumnConfig {
  id: string;
  label: string;
  defaultHeader: string;
  customHeader: string;
  enabled: boolean;
  getValue: (p: any) => any;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'name', label: '姓名', defaultHeader: '姓名', customHeader: '姓名', enabled: true, getValue: (p) => p.person_name || p.persons?.name || '-' },
  { id: 'contact', label: '电话', defaultHeader: '电话', customHeader: '电话', enabled: true, getValue: (p) => p.contact || p.persons?.contact || '-' },
  { id: 'introducer', label: '介绍人', defaultHeader: '介绍人', customHeader: '介绍人', enabled: true, getValue: (p) => p.introducer_name || p.leaders?.name || '-' },
  { id: 'gender', label: '性别', defaultHeader: '性别', customHeader: '性别', enabled: false, getValue: (p) => p.persons?.gender || '-' },
  { id: 'age', label: '年龄', defaultHeader: '年龄', customHeader: '年龄', enabled: false, getValue: (p) => p.persons?.age || '-' },
  { id: 'id_card', label: '身份证号', defaultHeader: '身份证号', customHeader: '身份证号', enabled: false, getValue: (p) => p.persons?.id_card || '-' },
  { id: 'specialization', label: '擅长领域', defaultHeader: '擅长领域', customHeader: '擅长领域', enabled: false, getValue: (p) => p.persons?.specialization || '-' },
  { id: 'status', label: '出席状态', defaultHeader: '出席状态', customHeader: '出席状态', enabled: false, getValue: (p) => p.status || '-' },
  { id: 'salary', label: '工资', defaultHeader: '工资', customHeader: '工资', enabled: false, getValue: (p) => p.salary || 0 },
  { id: 'deposit', label: '押金', defaultHeader: '押金', customHeader: '押金', enabled: false, getValue: (p) => p.deposit || 0 },
  { id: 'per_head_fee', label: '人头费', defaultHeader: '人头费', customHeader: '人头费', enabled: false, getValue: (p) => p.per_head_fee || 0 },
  { id: 'person_notes', label: '个人备注', defaultHeader: '个人备注', customHeader: '个人备注', enabled: false, getValue: (p) => p.persons?.notes || '-' },
  { id: 'participation_notes', label: '参与备注', defaultHeader: '参与备注', customHeader: '参与备注', enabled: false, getValue: (p) => p.notes || '-' },
];

const statusColors: Record<string, string> = {
  '待确认': 'bg-muted text-muted-foreground',
  '已确认': 'bg-primary text-primary-foreground',
  '进行中': 'bg-chart-1 text-primary-foreground',
  '已完成': 'bg-chart-2 text-primary-foreground',
  '已取消': 'bg-destructive text-destructive-foreground',
};

export default function ActivityParticipantsList() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  
  // 筛选条件
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterIsPaid, setFilterIsPaid] = useState<string>('all');
  
  // 导出格式
  const [exportFormat, setExportFormat] = useState<'single' | 'multiple'>('multiple');

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const data = await getActivities();
      setActivities(data);
    } catch (error) {
      console.error('加载活动列表失败:', error);
      toast.error('加载活动列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(activities.map(a => a.id));
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

  const handleExportClick = () => {
    if (selectedIds.length === 0) {
      toast.error('请至少选择一个活动');
      return;
    }
    setShowConfigDialog(true);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      setShowConfigDialog(false);
      const workbook = XLSX.utils.book_new();

      const selectedColumns = columns.filter(c => c.enabled);
      if (selectedColumns.length === 0) {
        toast.error('请至少选择一个导出字段');
        setExporting(false);
        return;
      }

      if (exportFormat === 'single') {
        // 单Sheet格式：所有活动的参与人员放在一个sheet中
        const allParticipants: any[] = [];
        
        for (const activityId of selectedIds) {
          const activity = activities.find(a => a.id === activityId);
          if (!activity) continue;

          // 获取该活动的参与人员详情
          let participants = await getActivityParticipantsWithDetails(activityId);
          
          // 应用筛选条件
          if (filterStatus.length > 0) {
            participants = participants.filter(p => filterStatus.includes(p.status));
          }
          
          if (filterIsPaid !== 'all') {
            const isPaidValue = filterIsPaid === 'true';
            participants = participants.filter(p => p.is_paid === isPaidValue);
          }

          // 为每个参与人员添加活动名称
          participants.forEach(p => {
            allParticipants.push({
              activity: activity,
              participant: p
            });
          });
        }

        // 准备sheet数据（添加序号和活动名称）
        const sheetData = allParticipants.map((item, index) => {
          const row: any = { 
            '序号': index + 1,
            '活动名称': item.activity.name
          };
          selectedColumns.forEach(col => {
            row[col.customHeader || col.defaultHeader] = col.getValue(item.participant);
          });
          return row;
        });

        // 如果没有参与人员，添加一行提示
        if (sheetData.length === 0) {
          const emptyRow: any = { 
            '序号': '-',
            '活动名称': '暂无符合条件的参与人员'
          };
          selectedColumns.forEach((col, idx) => {
            emptyRow[col.customHeader || col.defaultHeader] = '-';
          });
          sheetData.push(emptyRow);
        }

        // 创建worksheet
        const worksheet = XLSX.utils.json_to_sheet(sheetData);

        // 获取数据范围
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        
        // 设置表头样式
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
          if (!worksheet[cellAddress]) continue;
          
          worksheet[cellAddress].s = {
            font: { bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '4472C4' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } }
            }
          };
        }
        
        // 设置数据行样式和边框
        for (let row = range.s.r + 1; row <= range.e.r; row++) {
          for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            if (!worksheet[cellAddress]) continue;
            
            worksheet[cellAddress].s = {
              alignment: { horizontal: col === 0 ? 'center' : 'left', vertical: 'center' },
              border: {
                top: { style: 'thin', color: { rgb: 'D3D3D3' } },
                bottom: { style: 'thin', color: { rgb: 'D3D3D3' } },
                left: { style: 'thin', color: { rgb: 'D3D3D3' } },
                right: { style: 'thin', color: { rgb: 'D3D3D3' } }
              }
            };
            
            // 斑马纹效果
            if (row % 2 === 0) {
              worksheet[cellAddress].s.fill = { fgColor: { rgb: 'F2F2F2' } };
            }
          }
        }

        // 设置列宽（序号列固定8，活动名称列20，其他列自适应）
        worksheet['!cols'] = [
          { wch: 8 }, // 序号列
          { wch: 20 }, // 活动名称列
          ...selectedColumns.map(col => ({
            wch: Math.max((col.customHeader || col.defaultHeader).length * 2, 15)
          }))
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, '参与人员清单');
        
      } else {
        // 多Sheet格式：每个活动一个sheet（原有格式）
        for (const activityId of selectedIds) {
          const activity = activities.find(a => a.id === activityId);
          if (!activity) continue;

          // 获取该活动的参与人员详情
          let participants = await getActivityParticipantsWithDetails(activityId);
          
          // 应用筛选条件
          if (filterStatus.length > 0) {
            participants = participants.filter(p => filterStatus.includes(p.status));
          }
          
          if (filterIsPaid !== 'all') {
            const isPaidValue = filterIsPaid === 'true';
            participants = participants.filter(p => p.is_paid === isPaidValue);
          }

          // 准备sheet数据（添加序号）
          const sheetData = participants.map((p, index) => {
            const row: any = { '序号': index + 1 };
            selectedColumns.forEach(col => {
              row[col.customHeader || col.defaultHeader] = col.getValue(p);
            });
            return row;
          });

          // 如果没有参与人员，添加一行提示
          if (sheetData.length === 0) {
            const emptyRow: any = { '序号': '-' };
            selectedColumns.forEach((col, idx) => {
              emptyRow[col.customHeader || col.defaultHeader] = idx === 0 ? '暂无符合条件的参与人员' : '-';
            });
            sheetData.push(emptyRow);
          }

          // 创建worksheet
          const worksheet = XLSX.utils.json_to_sheet(sheetData);

          // 获取数据范围
          const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
          
          // 设置表头样式
          for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
            if (!worksheet[cellAddress]) continue;
            
            worksheet[cellAddress].s = {
              font: { bold: true, color: { rgb: 'FFFFFF' } },
              fill: { fgColor: { rgb: '4472C4' } },
              alignment: { horizontal: 'center', vertical: 'center' },
              border: {
                top: { style: 'thin', color: { rgb: '000000' } },
                bottom: { style: 'thin', color: { rgb: '000000' } },
                left: { style: 'thin', color: { rgb: '000000' } },
                right: { style: 'thin', color: { rgb: '000000' } }
              }
            };
          }
          
          // 设置数据行样式和边框
          for (let row = range.s.r + 1; row <= range.e.r; row++) {
            for (let col = range.s.c; col <= range.e.c; col++) {
              const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
              if (!worksheet[cellAddress]) continue;
              
              worksheet[cellAddress].s = {
                alignment: { horizontal: col === 0 ? 'center' : 'left', vertical: 'center' },
                border: {
                  top: { style: 'thin', color: { rgb: 'D3D3D3' } },
                  bottom: { style: 'thin', color: { rgb: 'D3D3D3' } },
                  left: { style: 'thin', color: { rgb: 'D3D3D3' } },
                  right: { style: 'thin', color: { rgb: 'D3D3D3' } }
                }
              };
              
              // 斑马纹效果
              if (row % 2 === 0) {
                worksheet[cellAddress].s.fill = { fgColor: { rgb: 'F2F2F2' } };
              }
            }
          }

          // 设置列宽（序号列固定8，其他列自适应）
          worksheet['!cols'] = [
            { wch: 8 }, // 序号列
            ...selectedColumns.map(col => ({
              wch: Math.max((col.customHeader || col.defaultHeader).length * 2, 15)
            }))
          ];

          // 使用活动名称作为sheet名称（Excel sheet名称有长度限制，最多31个字符）
          let sheetName = activity.name;
          if (sheetName.length > 31) {
            sheetName = sheetName.substring(0, 28) + '...';
          }
          
          // 移除sheet名称中的非法字符
          sheetName = sheetName.replace(/[:\\\/\?\*\[\]]/g, '_');

          // 处理sheet名称重复的问题
          let finalSheetName = sheetName;
          let counter = 1;
          while (workbook.SheetNames.includes(finalSheetName)) {
            const suffix = ` (${counter})`;
            finalSheetName = sheetName.substring(0, 31 - suffix.length) + suffix;
            counter++;
          }

          XLSX.utils.book_append_sheet(workbook, worksheet, finalSheetName);
        }
      }

      // 生成文件名
      const timestamp = format(new Date(), 'yyyyMMdd_HHmmss', { locale: zhCN });
      const fileName = `活动参与人员清单_${timestamp}.xlsx`;

      // 导出Excel文件
      XLSX.writeFile(workbook, fileName);
      toast.success(`成功导出 ${selectedIds.length} 个活动的参与人员清单`);
    } catch (error) {
      console.error('导出Excel失败:', error);
      toast.error('导出Excel失败');
    } finally {
      setExporting(false);
    }
  };

  const toggleColumn = (id: string, enabled: boolean) => {
    setColumns(columns.map(c => c.id === id ? { ...c, enabled } : c));
  };

  const updateHeader = (id: string, customHeader: string) => {
    setColumns(columns.map(c => c.id === id ? { ...c, customHeader } : c));
  };
  
  const toggleStatus = (status: string) => {
    if (filterStatus.includes(status)) {
      setFilterStatus(filterStatus.filter(s => s !== status));
    } else {
      setFilterStatus([...filterStatus, status]);
    }
  };

  const isAllSelected = activities.length > 0 && selectedIds.length === activities.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < activities.length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <Skeleton className="h-9 w-48 bg-muted" />
            <Skeleton className="h-5 w-64 mt-2 bg-muted" />
          </div>
          <Skeleton className="h-10 w-32 bg-muted" />
        </div>
        <Skeleton className="h-96 bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">活动和参与人员清单</h1>
          <p className="text-muted-foreground mt-2">选择活动并导出参与人员清单</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <>
              <NotificationConfig
                pageType="data-product"
                pageName="活动和参与人员清单"
                contentGetter={async () => {
                  // 生成报告内容
                  const selectedActivities = activities.filter(a => selectedIds.includes(a.id));
                  let content = '<h1>活动和参与人员清单</h1>';
                  content += `<p>生成时间：${new Date().toLocaleString('zh-CN')}</p>`;
                  content += `<p>包含活动数：${selectedActivities.length}</p>`;
                  
                  for (const activity of selectedActivities) {
                    content += `<h2>${activity.name}</h2>`;
                    content += `<p>日期：${activity.start_date || '-'}</p>`;
                    content += `<p>地点：${activity.location}</p>`;
                    
                    const participants = await getActivityParticipantsWithDetails(activity.id);
                    content += '<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">';
                    content += '<thead><tr><th>姓名</th><th>电话</th><th>介绍人</th><th>状态</th></tr></thead>';
                    content += '<tbody>';
                    participants.forEach(p => {
                      content += `<tr>
                        <td>${p.person_name || p.persons?.name || '-'}</td>
                        <td>${p.contact || p.persons?.contact || '-'}</td>
                        <td>${p.introducer_name || p.leaders?.name || '-'}</td>
                        <td>${p.status || '-'}</td>
                      </tr>`;
                    });
                    content += '</tbody></table>';
                  }
                  
                  return content;
                }}
              />
              <Button 
                onClick={handleExportClick} 
                disabled={exporting}
                className="bg-primary hover:bg-primary/90"
              >
                <FileDown className="h-4 w-4 mr-2" />
                {exporting ? '导出中...' : `导出选中 (${selectedIds.length})`}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-md border border-border overflow-x-auto max-w-full bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12 pl-6 sticky left-0 bg-muted/50 z-10 border-r border-border/50">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="全选"
                  className={isSomeSelected ? 'data-[state=checked]:bg-primary' : ''}
                />
              </TableHead>
              <TableHead className="min-w-[200px]">活动名称</TableHead>
              <TableHead className="w-[100px] whitespace-nowrap">类型</TableHead>
              <TableHead className="w-[100px] whitespace-nowrap">状态</TableHead>
              <TableHead className="w-[120px] text-center whitespace-nowrap">参与人数</TableHead>
              <TableHead className="w-[120px] text-center whitespace-nowrap pr-6">兼职工资</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  暂无活动数据
                </TableCell>
              </TableRow>
            ) : (
              activities.map((activity) => (
                <TableRow key={activity.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="pl-6 sticky left-0 bg-card z-10 border-r border-border/50 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                    <Checkbox
                      checked={selectedIds.includes(activity.id)}
                      onCheckedChange={(checked) => handleSelectOne(activity.id, checked as boolean)}
                      aria-label={`选择 ${activity.name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{activity.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal border-primary/20 text-primary whitespace-nowrap">
                      {activity.type || '短期'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("font-normal border-none whitespace-nowrap", statusColors[activity.status] || 'bg-muted text-muted-foreground')}>
                      {activity.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="font-semibold bg-primary/10 text-primary border-none">
                      {activity.participant_count || 0} 人
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap pr-6">
                    {activity.part_time_salary ? `¥${activity.part_time_salary}` : '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 导出配置对话框 */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-border/40 shadow-2xl">
          <DialogHeader className="p-6 pb-4 border-b bg-muted/20">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              导出配置
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              选择筛选条件、导出字段并自定义 Excel 中的列名称
            </p>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* 筛选条件部分 */}
            <div className="space-y-4 pb-6 border-b border-border">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground tracking-wider uppercase">
                <span className="border-l-2 border-primary pl-2">筛选条件</span>
                <span className="text-xs text-muted-foreground normal-case font-normal">(可选，不选则导出全部)</span>
              </div>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">参与状态</label>
                  <div className="flex flex-wrap gap-2">
                    {['待确认', '已确认', '已出席', '已合格', '未出席', '已取消'].map((status) => (
                      <div
                        key={status}
                        onClick={() => toggleStatus(status)}
                        className={cn(
                          "px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-all border",
                          filterStatus.includes(status)
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-muted/50 text-muted-foreground border-muted-foreground/20 hover:bg-muted hover:border-muted-foreground/40"
                        )}
                      >
                        {status}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">发薪状态</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'all', label: '全部' },
                      { value: 'true', label: '已发薪' },
                      { value: 'false', label: '未发薪' }
                    ].map((option) => (
                      <div
                        key={option.value}
                        onClick={() => setFilterIsPaid(option.value)}
                        className={cn(
                          "px-4 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-all border",
                          filterIsPaid === option.value
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-muted/50 text-muted-foreground border-muted-foreground/20 hover:bg-muted hover:border-muted-foreground/40"
                        )}
                      >
                        {option.label}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">导出格式</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'multiple', label: '多Sheet格式', desc: '每个活动一个Sheet' },
                      { value: 'single', label: '单Sheet格式', desc: '所有活动合并，增加活动名称列' }
                    ].map((option) => (
                      <div
                        key={option.value}
                        onClick={() => setExportFormat(option.value as 'single' | 'multiple')}
                        className={cn(
                          "flex-1 px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-all border",
                          exportFormat === option.value
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-muted/50 text-muted-foreground border-muted-foreground/20 hover:bg-muted hover:border-muted-foreground/40"
                        )}
                      >
                        <div className="font-semibold">{option.label}</div>
                        <div className="text-xs mt-0.5 opacity-80">{option.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* 导出字段配置部分 */}
            <div className="space-y-4">
              <div className="grid grid-cols-[1fr_2fr] gap-4 items-center px-2 text-sm font-semibold text-muted-foreground tracking-wider uppercase">
                <div className="flex items-center gap-2 pl-2 border-l-2 border-primary/30">
                  <span>导出字段</span>
                </div>
                <div className="pl-2 border-l-2 border-primary/30">Excel 表头名称</div>
              </div>
            
              <div className="grid gap-2">
                {columns.map((col) => (
                  <div 
                    key={col.id} 
                    className={cn(
                      "grid grid-cols-[1fr_2fr] gap-4 items-center p-3 rounded-lg border transition-all duration-300",
                      col.enabled 
                        ? "bg-primary/5 border-primary/30 ring-1 ring-primary/5 shadow-sm" 
                        : "bg-muted/30 border-muted-foreground/20 opacity-60 grayscale-[0.5]"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox 
                        id={`col-${col.id}`}
                        checked={col.enabled}
                        onCheckedChange={(checked) => toggleColumn(col.id, !!checked)}
                        className="data-[state=checked]:bg-primary h-5 w-5"
                      />
                      <label 
                        htmlFor={`col-${col.id}`} 
                        className={cn(
                          "text-sm font-medium leading-none cursor-pointer select-none",
                          col.enabled ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {col.label}
                      </label>
                    </div>
                    
                    <div className="relative group">
                      <Input 
                        value={col.customHeader}
                        onChange={(e) => updateHeader(col.id, e.target.value)}
                        disabled={!col.enabled}
                        placeholder={col.defaultHeader}
                        className={cn(
                          "h-10 bg-background border-muted-foreground/30 focus:border-primary focus:ring-primary transition-all",
                          !col.enabled && "bg-muted/50 cursor-not-allowed border-muted-foreground/10 opacity-50"
                        )}
                      />
                      {col.enabled && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary/50 uppercase tracking-tighter opacity-0 group-focus-within:opacity-0 group-hover:opacity-100 transition-opacity select-none">
                          EDITABLE
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter className="p-6 pt-4 border-t bg-muted/20">
            <div className="flex justify-between items-center w-full">
              <div className="text-sm font-medium text-muted-foreground">
                已选择 <span className="font-bold text-primary text-base">{columns.filter(c => c.enabled).length}</span> 个导出字段
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowConfigDialog(false)} className="hover:bg-muted transition-colors">
                  取消
                </Button>
                <Button onClick={handleExport} disabled={exporting} className="bg-primary hover:bg-primary/90 shadow-md">
                  {exporting ? '导出中...' : '确认导出'}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
