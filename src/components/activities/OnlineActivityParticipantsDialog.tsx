import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, X, TrendingUp, TrendingDown, UserPlus, Trash2, Search, CalendarIcon, ArrowUpDown, ArrowDownAZ, ArrowUpAZ } from 'lucide-react';
import { toast } from 'sonner';
import { getActivityLeadersWithCount, updateActivityLeaderCount, getActivityLeaderChanges, getLeaders, addLeaderToActivity, removeLeaderFromActivity } from '@/db/api';
import type { ActivityLeaderChange, Leader } from '@/types';
import { useAuthCheck } from '@/hooks/use-auth-check';
import { format, startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
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

interface OnlineActivityParticipantsDialogProps {
  activityId: string;
  activityName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function OnlineActivityParticipantsDialog({
  activityId,
  activityName,
  open,
  onOpenChange,
}: OnlineActivityParticipantsDialogProps) {
  const { checkAuth } = useAuthCheck();
  const [activityLeaders, setActivityLeaders] = useState<any[]>([]);
  const [changes, setChanges] = useState<ActivityLeaderChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 表单状态
  const [changeAmount, setChangeAmount] = useState('');
  const [note, setNote] = useState('');

  // 添加领队面板状态
  const [addLeaderOpen, setAddLeaderOpen] = useState(false);
  const [allLeaders, setAllLeaders] = useState<Leader[]>([]);
  const [leaderSearch, setLeaderSearch] = useState('');
  const [addingLeaderId, setAddingLeaderId] = useState<string | null>(null);
  const [removingLeaderId, setRemovingLeaderId] = useState<string | null>(null);
  // 移除确认弹窗状态
  const [removeConfirmTarget, setRemoveConfirmTarget] = useState<any | null>(null);

  // 变更记录筛选/排序状态
  const [filterLeaderId, setFilterLeaderId] = useState<string>('all');
  const [dateStart, setDateStart] = useState<Date | undefined>(undefined);
  const [dateEnd, setDateEnd] = useState<Date | undefined>(undefined);
  const [sortByLeader, setSortByLeader] = useState<'none' | 'asc' | 'desc'>('none');

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, activityId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [leadersData, changesData, allLeadersData] = await Promise.all([
        getActivityLeadersWithCount(activityId),
        getActivityLeaderChanges(activityId),
        getLeaders(),
      ]);
      setActivityLeaders(leadersData);
      setChanges(changesData);
      setAllLeaders(allLeadersData);
    } catch (error) {
      console.error('加载数据失败:', error);
      toast.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setChangeAmount('');
    setNote('');
    setEditingId(null);
  };

  const handleUpdateCount = async () => {
    if (!checkAuth('修改参与人员')) return;
    if (!editingId) return;

    const amount = parseInt(changeAmount);
    if (isNaN(amount) || amount === 0) {
      toast.error('请输入有效的变更数量（不能为0）');
      return;
    }

    try {
      const result = await updateActivityLeaderCount(editingId, amount, note);
      
      if (amount > 0) {
        toast.success(`成功增加 ${amount} 人，当前人数：${result.new_count}`);
      } else {
        toast.success(`成功减少 ${Math.abs(amount)} 人，当前人数：${result.new_count}`);
      }
      
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('修改人数失败:', error);
      if (error.message?.includes('不能为负数')) {
        toast.error('人数不能为负数，请减少变更数量');
      } else {
        toast.error(error.message || '修改人数失败');
      }
    }
  };

  const handleEdit = (leader: any) => {
    setEditingId(leader.id);
    setChangeAmount('');
    setNote('');
  };

  // 已关联领队的 leader_id 集合
  const existingLeaderIds = useMemo(
    () => new Set(activityLeaders.map((al) => al.leader_id)),
    [activityLeaders]
  );

  // 过滤可添加的领队（排除已关联的，支持搜索）
  const availableLeaders = useMemo(() => {
    const keyword = leaderSearch.trim().toLowerCase();
    return allLeaders.filter((l) => {
      if (existingLeaderIds.has(l.id)) return false;
      if (!keyword) return true;
      return (
        l.name.toLowerCase().includes(keyword) ||
        (l.contact || '').toLowerCase().includes(keyword) ||
        (l.wechat || '').toLowerCase().includes(keyword)
      );
    });
  }, [allLeaders, existingLeaderIds, leaderSearch]);

  const handleAddLeader = async (leaderId: string) => {
    if (!checkAuth('添加领队')) return;
    setAddingLeaderId(leaderId);
    try {
      await addLeaderToActivity(activityId, leaderId);
      toast.success('领队添加成功');
      await loadData();
    } catch (error: any) {
      console.error('添加领队失败:', error);
      toast.error(error.message || '添加领队失败');
    } finally {
      setAddingLeaderId(null);
    }
  };

  const handleRemoveLeader = async (al: any) => {
    if (!checkAuth('移除领队')) return;
    setRemovingLeaderId(al.id);
    try {
      await removeLeaderFromActivity(activityId, al.leader_id);
      toast.success(`已移除领队：${al.leader?.name}`);
      resetForm();
      await loadData();
    } catch (error: any) {
      console.error('移除领队失败:', error);
      toast.error(error.message || '移除领队失败');
    } finally {
      setRemovingLeaderId(null);
      setRemoveConfirmTarget(null);
    }
  };

  const totalCount = activityLeaders.reduce((sum, al) => sum + (al.participant_count || 0), 0);

  // 重置变更记录筛选排序
  const resetHistoryFilters = () => {
    setFilterLeaderId('all');
    setDateStart(undefined);
    setDateEnd(undefined);
    setSortByLeader('none');
  };

  // 变更记录筛选排序（可叠加）
  const filteredChanges = useMemo(() => {
    let result = [...changes];

    // 按领队筛选
    if (filterLeaderId !== 'all') {
      result = result.filter((c) => c.leader_id === filterLeaderId || c.leader?.id === filterLeaderId);
    }

    // 按时间范围筛选
    if (dateStart || dateEnd) {
      const start = dateStart ? startOfDay(dateStart) : null;
      const end = dateEnd ? endOfDay(dateEnd) : null;
      result = result.filter((c) => {
        const changedAt = parseISO(c.changed_at);
        if (start && end) {
          return isWithinInterval(changedAt, { start, end });
        }
        if (start) return changedAt >= start;
        if (end) return changedAt <= end;
        return true;
      });
    }

    // 按领队排序：相同领队集中在一起，再按时间倒序排列
    if (sortByLeader !== 'none') {
      result.sort((a, b) => {
        const nameCompare = (a.leader?.name || '').localeCompare(b.leader?.name || '', 'zh-CN');
        if (nameCompare !== 0) {
          return sortByLeader === 'asc' ? nameCompare : -nameCompare;
        }
        // 相同领队时按变更时间倒序排列，最新的在前面
        return new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime();
      });
    }

    return result;
  }, [changes, filterLeaderId, dateStart, dateEnd, sortByLeader]);

  // 参与过本活动的领队选项（去重）
  const changeLeaderOptions = useMemo(() => {
    const map = new Map<string, Leader>();
    changes.forEach((c) => {
      if (c.leader) map.set(c.leader.id, c.leader);
      else if (c.leader_id) {
        const found = activityLeaders.find((al) => al.leader_id === c.leader_id || al.leader?.id === c.leader_id)?.leader;
        if (found) map.set(found.id, found);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }, [changes, activityLeaders]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[80vw] max-w-none sm:max-w-[80vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>线上活动参与人数管理 - {activityName}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="leaders" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="leaders">领队人数</TabsTrigger>
            <TabsTrigger value="history">变更记录</TabsTrigger>
          </TabsList>

          <TabsContent value="leaders" className="space-y-4">
            {/* 统计信息 */}
            <div className="bg-muted p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">领队数量</div>
                  <div className="text-2xl font-bold">{activityLeaders.length}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">总参与人数</div>
                  <div className="text-2xl font-bold text-primary">{totalCount}</div>
                </div>
              </div>
            </div>

            {/* 添加领队按钮 */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAddLeaderOpen((v) => !v);
                  setLeaderSearch('');
                }}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                添加领队
              </Button>
            </div>

            {/* 添加领队内联面板 */}
            {addLeaderOpen && (
              <div className="border rounded-lg p-4 space-y-3 bg-accent/30 overflow-hidden">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">选择要添加的领队</h3>
                  <Button variant="ghost" size="sm" onClick={() => setAddLeaderOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索姓名、联系方式或微信..."
                    value={leaderSearch}
                    onChange={(e) => setLeaderSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                {availableLeaders.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-3">
                    {leaderSearch ? '没有匹配的领队' : '所有领队已全部添加'}
                  </p>
                ) : (
                  <ScrollArea className="h-52 border rounded-md bg-background">
                    <div className="p-1">
                      {availableLeaders.map((leader) => (
                        <div
                          key={leader.id}
                          className="flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-muted transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm truncate">{leader.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {leader.contact && <span className="mr-2">{leader.contact}</span>}
                              {leader.wechat && <span>微信: {leader.wechat}</span>}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            disabled={addingLeaderId === leader.id}
                            onClick={() => handleAddLeader(leader.id)}
                            className="shrink-0"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            {addingLeaderId === leader.id ? '添加中...' : '添加'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}

            {/* 编辑表单 */}
            {editingId && (
              <div className="border rounded-lg p-4 space-y-4 bg-accent/50">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">修改人数</h3>
                  <Button variant="ghost" size="sm" onClick={resetForm}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>变更数量 *</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={changeAmount}
                      onChange={(e) => setChangeAmount(e.target.value)}
                      placeholder="输入变更数量（正数增加，负数减少）"
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setChangeAmount((prev) => {
                        const num = parseInt(prev) || 0;
                        return (num + 1).toString();
                      })}
                    >
                      +1
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setChangeAmount((prev) => {
                        const num = parseInt(prev) || 0;
                        return (num - 1).toString();
                      })}
                    >
                      -1
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    例如：输入 +5 增加5人，输入 -3 减少3人
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>备注</Label>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="输入变更原因或备注"
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={resetForm}>
                    取消
                  </Button>
                  <Button onClick={handleUpdateCount}>
                    确认修改
                  </Button>
                </div>
              </div>
            )}

            {/* 领队列表 */}
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">加载中...</div>
            ) : activityLeaders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无领队，请点击「添加领队」按钮添加
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>领队</TableHead>
                      <TableHead>联系方式</TableHead>
                      <TableHead>微信</TableHead>
                      <TableHead className="text-center">当前人数</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityLeaders.map((al) => (
                      <TableRow key={al.id}>
                        <TableCell className="font-medium">{al.leader?.name}</TableCell>
                        <TableCell>{al.leader?.contact}</TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {al.leader?.wechat || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-lg font-semibold text-primary">
                            {al.participant_count || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(al)}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              修改人数
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={removingLeaderId === al.id}
                              onClick={() => setRemoveConfirmTarget(al)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {/* 筛选排序工具栏 */}
            <div className="flex flex-wrap gap-3 items-end p-3 border rounded-lg bg-muted/50">
              <div className="w-full md:w-48">
                <label className="text-xs text-muted-foreground mb-1 block">按领队筛选</label>
                <Select value={filterLeaderId} onValueChange={setFilterLeaderId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="全部领队" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部领队</SelectItem>
                    {changeLeaderOptions.map((leader) => (
                      <SelectItem key={leader.id} value={leader.id}>
                        {leader.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">开始日期</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-full md:w-40 justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                      {dateStart ? format(dateStart, 'yyyy-MM-dd') : '选择日期'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateStart}
                      onSelect={setDateStart}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">结束日期</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-full md:w-40 justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                      {dateEnd ? format(dateEnd, 'yyyy-MM-dd') : '选择日期'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateEnd}
                      onSelect={setDateEnd}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">按领队排序</label>
                <div className="flex gap-1">
                  <Button
                    variant={sortByLeader === 'asc' ? 'default' : 'outline'}
                    size="sm"
                    className="h-9 px-3"
                    onClick={() => setSortByLeader((prev) => (prev === 'asc' ? 'none' : 'asc'))}
                  >
                    <ArrowDownAZ className="h-4 w-4 mr-1" />
                    升序
                  </Button>
                  <Button
                    variant={sortByLeader === 'desc' ? 'default' : 'outline'}
                    size="sm"
                    className="h-9 px-3"
                    onClick={() => setSortByLeader((prev) => (prev === 'desc' ? 'none' : 'desc'))}
                  >
                    <ArrowUpAZ className="h-4 w-4 mr-1" />
                    降序
                  </Button>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="h-9"
                onClick={resetHistoryFilters}
              >
                <X className="h-4 w-4 mr-1" />
                重置
              </Button>
            </div>

            {/* 统计摘要 */}
            {!loading && changes.length > 0 && (
              <div className="text-sm text-muted-foreground">
                共 {changes.length} 条记录
                {filteredChanges.length !== changes.length && (
                  <span>，筛选后 {filteredChanges.length} 条</span>
                )}
                {(filterLeaderId !== 'all' || dateStart || dateEnd || sortByLeader !== 'none') && (
                  <span className="ml-2">
                    （已启用：
                    {filterLeaderId !== 'all' && '领队筛选 '}
                    {(dateStart || dateEnd) && '时间范围 '}
                    {sortByLeader !== 'none' && (sortByLeader === 'asc' ? '领队升序' : '领队降序')}
                    ）
                  </span>
                )}
              </div>
            )}

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">加载中...</div>
            ) : filteredChanges.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {changes.length === 0 ? '暂无变更记录' : '没有符合筛选条件的记录'}
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>时间</TableHead>
                      <TableHead>领队</TableHead>
                      <TableHead className="text-center">变更数量</TableHead>
                      <TableHead className="text-center">变更前</TableHead>
                      <TableHead className="text-center">变更后</TableHead>
                      <TableHead>备注</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredChanges.map((change) => (
                      <TableRow key={change.id}>
                        <TableCell className="text-sm">
                          {format(new Date(change.changed_at), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                        </TableCell>
                        <TableCell className="font-medium">{change.leader?.name}</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={change.change_amount > 0 ? 'default' : 'destructive'}
                            className="font-mono"
                          >
                            {change.change_amount > 0 ? (
                              <TrendingUp className="h-3 w-3 mr-1" />
                            ) : (
                              <TrendingDown className="h-3 w-3 mr-1" />
                            )}
                            {change.change_amount > 0 ? '+' : ''}{change.change_amount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {change.previous_count}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {change.new_count}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {change.note || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

    {/* 移除领队确认弹窗 */}
    <AlertDialog open={!!removeConfirmTarget} onOpenChange={(open) => { if (!open) setRemoveConfirmTarget(null); }}>
      <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>确认移除领队</AlertDialogTitle>
          <AlertDialogDescription>
            确定要将领队「{removeConfirmTarget?.leader?.name}」从本活动移除吗？此操作无法撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => removeConfirmTarget && handleRemoveLeader(removeConfirmTarget)}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            移除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
