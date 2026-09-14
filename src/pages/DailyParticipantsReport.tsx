import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, ArrowUpDown, Search, RefreshCw, Download } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { getParticipantsByDateRange } from '@/db/api';
import { toast } from 'sonner';
import { formatApiError } from '@/lib/user-friendly-messages';
import * as XLSX from 'xlsx';

interface DailyParticipant {
  id: string;
  activity_name: string;
  person_name: string;
  person_contact: string;
  introducer_name: string;
  status: string;
  created_at: string;
  notes: string | null;
}

type SortConfig = {
  key: keyof DailyParticipant;
  direction: 'asc' | 'desc';
} | null;

export default function DailyParticipantsReport() {
  const [startDate, setStartDate] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [data, setData] = useState<DailyParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await getParticipantsByDateRange(startDate, endDate);
      setData(result);
    } catch (error) {
      console.error('加载报表失败:', error);
      toast.error(formatApiError(error, '报表数据'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  const handleSort = (key: keyof DailyParticipant) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // 搜索过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        item =>
          item.activity_name.toLowerCase().includes(query) ||
          item.person_name.toLowerCase().includes(query) ||
          item.introducer_name.toLowerCase().includes(query) ||
          item.person_contact.includes(query)
      );
    }

    // 排序
    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key] || '';
        const bValue = b[sortConfig.key] || '';
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, searchQuery, sortConfig]);

  const handleExport = () => {
    if (filteredAndSortedData.length === 0) {
      toast.error('当前无数据可供导出');
      return;
    }

    const exportData = filteredAndSortedData.map(item => ({
      '活动名称': item.activity_name,
      '参与人员': item.person_name,
      '联系方式': item.person_contact,
      '介绍人': item.introducer_name,
      '状态': item.status,
      '录入时间': format(new Date(item.created_at), 'yyyy-MM-dd HH:mm:ss'),
      '备注': item.notes || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '新增人员统计');
    
    // 设置列宽
    const wscols = [
      { wch: 30 }, // 活动名称
      { wch: 15 }, // 参与人员
      { wch: 20 }, // 联系方式
      { wch: 15 }, // 介绍人
      { wch: 10 }, // 状态
      { wch: 20 }, // 录入时间
      { wch: 40 }, // 备注
    ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, `新增参与人员报表_${startDate}_至_${endDate}.xlsx`);
    toast.success('报表导出成功');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">新增参与人员统计</h1>
          <p className="text-muted-foreground mt-1">查看选定日期范围内新录入的活动参与人员数据</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-card border rounded-md px-3 py-1 shadow-sm">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border-none shadow-none focus-visible:ring-0 p-0 h-8 w-32 bg-transparent text-sm"
              />
              <span className="text-muted-foreground">至</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border-none shadow-none focus-visible:ring-0 p-0 h-8 w-32 bg-transparent text-sm"
              />
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={loadData} disabled={loading} title="刷新数据">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="default" onClick={handleExport} disabled={loading || filteredAndSortedData.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            导出 Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-lg">统计详情</CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索活动、人员、介绍人..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[200px]">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('activity_name')} className="-ml-2 h-8">
                      活动名称 <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('person_name')} className="-ml-2 h-8">
                      参与人员 <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>联系方式</TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('introducer_name')} className="-ml-2 h-8">
                      介绍人 <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('status')} className="-ml-2 h-8">
                      状态 <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('created_at')} className="-ml-2 h-8">
                      录入时间 <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>备注</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      正在加载数据...
                    </TableCell>
                  </TableRow>
                ) : filteredAndSortedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      {searchQuery ? '未找到匹配结果' : '选定范围内无新增参与人员'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedData.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{item.activity_name}</TableCell>
                      <TableCell>{item.person_name}</TableCell>
                      <TableCell>{item.person_contact}</TableCell>
                      <TableCell>
                        <Badge variant={item.introducer_name === '直接报名' ? 'outline' : 'secondary'}>
                          {item.introducer_name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.status === '已确认' || item.status === '出席' ? 'default' : 'secondary'}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(item.created_at), 'yyyy-MM-dd HH:mm:ss')}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground" title={item.notes || ''}>
                        {item.notes || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm text-muted-foreground">
            <div>
              共计 {filteredAndSortedData.length} 条记录
            </div>
            <div>
              统计范围：{startDate} 至 {endDate}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
