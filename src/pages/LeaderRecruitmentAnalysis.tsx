import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Eye, FileDown, Filter, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { getLeaderRecruitmentStats, getLeaderRecruitmentDetail, getLeaders, getActivities } from '@/db/api';
import type { LeaderRecruitmentStats, Leader, Activity } from '@/types';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { userFriendlyMessages, formatApiError } from '@/lib/user-friendly-messages';
import { NotificationConfig } from '@/components/common/NotificationConfig';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658'];

export default function LeaderRecruitmentAnalysis() {
  const [stats, setStats] = useState<LeaderRecruitmentStats[]>([]);
  const [allLeaders, setAllLeaders] = useState<Leader[]>([]);
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [selectedLeaderIds, setSelectedLeaderIds] = useState<string[]>([]);
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  const [tempSelectedLeaderIds, setTempSelectedLeaderIds] = useState<string[]>([]); // 临时选择状态
  const [tempSelectedActivityIds, setTempSelectedActivityIds] = useState<string[]>([]); // 临时选择活动状态
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false); // 控制Popover开关
  const [selectedLeader, setSelectedLeader] = useState<any>(null);
  const [showResults, setShowResults] = useState(false); // 是否显示结果
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (showResults && allLeaders.length > 0) {
      loadStats();
    }
  }, [selectedLeaderIds, showResults]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [leadersData, activitiesData] = await Promise.all([
        getLeaders(),
        getActivities()
      ]);
      setAllLeaders(leadersData);
      setAllActivities(activitiesData);
      
      // 默认选择所有领队
      const allLeaderIds = leadersData.map(l => l.id);
      setSelectedLeaderIds(allLeaderIds);
      setTempSelectedLeaderIds(allLeaderIds);
    } catch (error) {
      console.error('加载数据失败:', error);
      toast.error(formatApiError(error, '基础数据'));
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await getLeaderRecruitmentStats(selectedActivityIds);
      // 根据选中的领队过滤数据
      const filteredData = selectedLeaderIds.length > 0
        ? data.filter(s => selectedLeaderIds.includes(s.leader_id))
        : data;
      setStats(filteredData);
    } catch (error) {
      console.error('加载领队招募统计失败:', error);
      toast.error(formatApiError(error, '领队招募统计'));
    } finally {
      setLoading(false);
    }
  };

  const handleLeaderToggle = (leaderId: string) => {
    setTempSelectedLeaderIds(prev => {
      if (prev.includes(leaderId)) {
        return prev.filter(id => id !== leaderId);
      } else {
        return [...prev, leaderId];
      }
    });
  };

  const handleSelectAll = () => {
    if (tempSelectedLeaderIds.length === allLeaders.length) {
      setTempSelectedLeaderIds([]);
    } else {
      setTempSelectedLeaderIds(allLeaders.map(l => l.id));
    }
  };

  const handleConfirmSelection = () => {
    setSelectedLeaderIds(tempSelectedLeaderIds);
    setFilterPopoverOpen(false);
    toast.success('已更新领队筛选条件');
  };

  const handleActivityToggle = (activityId: string) => {
    setTempSelectedActivityIds(prev => {
      if (prev.includes(activityId)) {
        return prev.filter(id => id !== activityId);
      } else {
        return [...prev, activityId];
      }
    });
  };

  const handleSelectAllActivities = () => {
    if (tempSelectedActivityIds.length === allActivities.length) {
      setTempSelectedActivityIds([]);
    } else {
      setTempSelectedActivityIds(allActivities.map(a => a.id));
    }
  };

  const handleGenerateReport = async () => {
    if (tempSelectedActivityIds.length === 0) {
      toast.error('请至少选择一个活动进行统计');
      return;
    }
    setSelectedActivityIds(tempSelectedActivityIds);
    setShowResults(true);
  };

  const handleBackToSelection = () => {
    setShowResults(false);
    setStats([]);
  };


  const handleCancelSelection = () => {
    setTempSelectedLeaderIds(selectedLeaderIds);
    setFilterPopoverOpen(false);
  };

  const handlePopoverOpenChange = (open: boolean) => {
    if (open) {
      // 打开时，同步临时选择状态
      setTempSelectedLeaderIds(selectedLeaderIds);
    }
    setFilterPopoverOpen(open);
  };

  const handleViewDetail = async (leaderId: string) => {
    try {
      const detail = await getLeaderRecruitmentDetail(leaderId);
      setSelectedLeader(detail);
      setDetailDialogOpen(true);
    } catch (error) {
      console.error('加载领队详情失败:', error);
      toast.error(formatApiError(error, '领队详情'));
    }
  };

  const handleExportPDF = async () => {
    if (!contentRef.current) return;
    
    if (stats.length === 0) {
      toast.error('没有可导出的数据，请先选择领队进行分析。');
      return;
    }

    try {
      setExporting(true);
      toast.info('正在生成PDF，请稍候...');

      // 创建一个临时容器用于渲染
      const element = contentRef.current;
      
      // 使用html2canvas将内容转换为图片
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 210; // A4宽度（mm）
      const pageHeight = 297; // A4高度（mm）
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // 添加第一页
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // 如果内容超过一页，添加更多页
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // 保存PDF
      const fileName = `领队招募分析_${new Date().toLocaleDateString()}.pdf`;
      pdf.save(fileName);
      
      toast.success('PDF导出成功！');
    } catch (error) {
      console.error('导出PDF失败:', error);
      toast.error('导出PDF失败，请稍后重试。\n\n💡 可能原因：浏览器阻止了文件下载或内容过大。\n\n💡 解决方法：请检查浏览器的下载设置，或尝试减少选择的领队数量。如需帮助，请联系技术支持。');
    } finally {
      setExporting(false);
    }
  };

  // 准备图表数据
  const chartData = stats.map(s => ({
    name: s.leader_name,
    招募人数: s.total_recruited,
    活动数量: s.total_activities,
    出勤率: s.attendance_rate,
  }));

  // 活动类型分布数据（汇总所有领队）
  const allActivityTypes: { [key: string]: number } = {};
  stats.forEach(s => {
    Object.entries(s.activity_type_distribution).forEach(([type, count]) => {
      allActivityTypes[type] = (allActivityTypes[type] || 0) + count;
    });
  });
  const pieData = Object.entries(allActivityTypes).map(([name, value]) => ({
    name,
    value,
  }));

  if (loading && !showResults) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (!showResults) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">领队招募情况分析</h1>
        </div>
        
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>第一步：选择活动</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">请选择要纳入统计分析的活动范围</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleSelectAllActivities}>
                {tempSelectedActivityIds.length === allActivities.length ? '取消全选' : '全选'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[50vh] overflow-y-auto p-4 border rounded-md mb-6">
              {allActivities.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  暂无活动数据
                </div>
              ) : (
                allActivities.map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-3 p-2 hover:bg-accent rounded-md transition-colors border border-transparent hover:border-border">
                    <Checkbox
                      id={`activity-${activity.id}`}
                      checked={tempSelectedActivityIds.includes(activity.id)}
                      onCheckedChange={() => handleActivityToggle(activity.id)}
                    />
                    <Label
                      htmlFor={`activity-${activity.id}`}
                      className="text-sm font-normal cursor-pointer flex-1 line-clamp-1"
                      title={activity.name}
                    >
                      <div className="font-medium">{activity.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {activity.start_date || '无日期'} | {activity.type || '未分类'}
                      </div>
                    </Label>
                  </div>
                ))
              )}
            </div>
            
            <div className="flex justify-center">
              <Button size="lg" className="w-full md:w-64" onClick={handleGenerateReport} disabled={tempSelectedActivityIds.length === 0 || loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    统计生成中...
                  </>
                ) : '生成统计分析结果'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading && stats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium text-lg">正在生成统计分析结果，请稍候...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handleBackToSelection}>
            <Filter className="h-4 w-4 mr-2" />
            重新选择活动
          </Button>
          <h1 className="text-3xl font-bold">领队招募情况分析结果</h1>
        </div>
        <div className="flex gap-2">
          {/* 领队选择器 */}
          <Popover open={filterPopoverOpen} onOpenChange={handlePopoverOpenChange}>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                选择领队
                {selectedLeaderIds.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {selectedLeaderIds.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">选择要分析的领队</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    {tempSelectedLeaderIds.length === allLeaders.length ? '取消全选' : '全选'}
                  </Button>
                </div>
                <div className="max-h-[300px] overflow-y-auto space-y-2">
                  {allLeaders.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      暂无领队数据
                    </div>
                  ) : (
                    allLeaders.map((leader) => (
                      <div key={leader.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`leader-${leader.id}`}
                          checked={tempSelectedLeaderIds.includes(leader.id)}
                          onCheckedChange={() => handleLeaderToggle(leader.id)}
                        />
                        <Label
                          htmlFor={`leader-${leader.id}`}
                          className="text-sm font-normal cursor-pointer flex-1"
                        >
                          {leader.name}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
                {/* 确认和取消按钮 */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={handleCancelSelection}
                  >
                    取消
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={handleConfirmSelection}
                    disabled={tempSelectedLeaderIds.length === 0}
                  >
                    确认
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* 通知配置按钮 */}
          <NotificationConfig
            pageType="analytics"
            pageName="领队招募情况分析"
            contentGetter={async () => {
              // 生成报告内容
              let content = '<h1>领队招募情况分析报告</h1>';
              content += `<p>生成时间：${new Date().toLocaleString('zh-CN')}</p>`;
              content += '<h2>统计概览</h2>';
              content += '<ul>';
              content += `<li>总领队数：${stats.length}</li>`;
              content += `<li>总招募活动数：${stats.reduce((sum, s) => sum + s.total_activities, 0)}</li>`;
              content += `<li>总招募人数：${stats.reduce((sum, s) => sum + s.total_recruited, 0)}</li>`;
              content += '</ul>';
              content += '<h2>详细数据</h2>';
              content += '<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">';
              content += '<thead><tr><th>领队</th><th>招募活动数</th><th>招募人数</th><th>平均每活动招募</th></tr></thead>';
              content += '<tbody>';
              stats.forEach(stat => {
                const avgRecruited = stat.total_activities > 0 
                  ? (stat.total_recruited / stat.total_activities).toFixed(1) 
                  : '0';
                content += `<tr>
                  <td>${stat.leader_name}</td>
                  <td>${stat.total_activities}</td>
                  <td>${stat.total_recruited}</td>
                  <td>${avgRecruited}</td>
                </tr>`;
              });
              content += '</tbody></table>';
              return content;
            }}
          />

          {/* 导出PDF按钮 */}
          <Button
            onClick={handleExportPDF}
            disabled={exporting || stats.length === 0}
          >
            <FileDown className="h-4 w-4 mr-2" />
            {exporting ? '导出中...' : '导出PDF'}
          </Button>
        </div>
      </div>

      {/* 可导出的内容区域 */}
      <div ref={contentRef}>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              活跃领队数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              总招募人数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.reduce((sum, s) => sum + s.total_recruited, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              总活动数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.reduce((sum, s) => sum + s.total_activities, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              平均出勤率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(() => {
                const statsWithAttendance = stats.filter(s => s.attendance_rate !== null);
                return statsWithAttendance.length > 0
                  ? Math.round(
                      statsWithAttendance.reduce((sum, s) => sum + (s.attendance_rate || 0), 0) / statsWithAttendance.length
                    )
                  : 0;
              })()}
              %
            </div>
            <p className="text-xs text-muted-foreground mt-1">（仅统计常规活动）</p>
          </CardContent>
        </Card>
      </div>

      {/* 图表区域 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>领队招募人数对比</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData} margin={{ bottom: 80, left: 10, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                  tick={{ fontSize: 12 }}
                />
                <YAxis />
                <Tooltip />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="招募人数" fill="#8884d8" />
                <Bar dataKey="活动数量" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>活动类型分布</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 领队列表 */}
      <Card>
        <CardHeader>
          <CardTitle>领队招募详情</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>领队姓名</TableHead>
                <TableHead className="text-center">招募人数</TableHead>
                <TableHead className="text-center">活动数量</TableHead>
                <TableHead className="text-center">出勤率</TableHead>
                <TableHead>活动类型分布</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                stats.map((stat) => (
                  <TableRow key={stat.leader_id}>
                    <TableCell className="font-medium">{stat.leader_name}</TableCell>
                    <TableCell className="text-center">{stat.total_recruited}</TableCell>
                    <TableCell className="text-center">{stat.total_activities}</TableCell>
                    <TableCell className="text-center">{stat.attendance_rate !== null ? `${stat.attendance_rate}%` : '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(stat.activity_type_distribution).map(([type, count]) => (
                          <Badge key={type} variant="secondary" className="text-xs">
                            {type}: {count}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetail(stat.leader_id)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        查看详情
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
      {/* 结束可导出内容区域 */}

      {/* 详情对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedLeader?.leader?.name} - 招募详情
            </DialogTitle>
          </DialogHeader>
          {selectedLeader && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">招募总人数</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {selectedLeader.total_recruited_count}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">（含线上人数）</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">总活动次数</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {selectedLeader.total_activities_count}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">平均出勤率</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {selectedLeader.recruited_persons.length > 0
                        ? Math.round(
                            selectedLeader.recruited_persons.reduce(
                              (sum: number, p: any) => sum + p.attendance_rate,
                              0
                            ) / selectedLeader.recruited_persons.length
                          )
                        : 0}
                      %
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">（仅限常规活动）</p>
                  </CardContent>
                </Card>
              </div>

              {selectedLeader.recruited_persons.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">常规活动招募人员清单</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>人员姓名</TableHead>
                        <TableHead>联系方式</TableHead>
                        <TableHead className="text-center">参与活动数</TableHead>
                        <TableHead className="text-center">出勤次数</TableHead>
                        <TableHead className="text-center">出勤率</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedLeader.recruited_persons.map((p: any) => (
                        <TableRow key={p.person.id}>
                          <TableCell className="font-medium">{p.person.name}</TableCell>
                          <TableCell>{p.person.contact}</TableCell>
                          <TableCell className="text-center">{p.total_activities}</TableCell>
                          <TableCell className="text-center">{p.attendance_count}</TableCell>
                          <TableCell className="text-center">{p.attendance_rate}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {selectedLeader.online_activities_summary && selectedLeader.online_activities_summary.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">线上活动招募详情</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>活动名称</TableHead>
                        <TableHead>活动日期</TableHead>
                        <TableHead className="text-center">拉人数量</TableHead>
                        <TableHead>备注说明</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedLeader.online_activities_summary.map((oa: any) => (
                        <TableRow key={oa.id}>
                          <TableCell className="font-medium">{oa.activities?.name}</TableCell>
                          <TableCell>{oa.activities?.start_date || '-'}</TableCell>
                          <TableCell className="text-center font-bold">{oa.participant_count}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{oa.notes || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
