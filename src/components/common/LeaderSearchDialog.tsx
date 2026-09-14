import { useState, useEffect, useMemo } from 'react';
import { Search, X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getLeaders } from '@/db/api';
import type { Leader } from '@/types';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { getRecentLeaderIds, addRecentLeader } from '@/utils/recentLeaders';

interface LeaderSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (leader: Leader | null) => void;
  selectedLeader?: Leader | null;
}

export default function LeaderSearchDialog({
  open,
  onOpenChange,
  onSelect,
  selectedLeader,
}: LeaderSearchDialogProps) {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [filteredLeaders, setFilteredLeaders] = useState<Leader[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // 获取最近使用的领队
  const recentLeaders = useMemo(() => {
    const recentIds = getRecentLeaderIds();
    return leaders.filter(leader => recentIds.includes(leader.id))
      .sort((a, b) => {
        const indexA = recentIds.indexOf(a.id);
        const indexB = recentIds.indexOf(b.id);
        return indexA - indexB;
      });
  }, [leaders]);

  // 获取其他领队（不在最近使用中的）
  const otherLeaders = useMemo(() => {
    const recentIds = getRecentLeaderIds();
    return leaders.filter(leader => !recentIds.includes(leader.id));
  }, [leaders]);

  useEffect(() => {
    if (open) {
      // 重置搜索查询
      setSearchQuery('');
      loadLeaders();
    }
  }, [open]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = leaders.filter(
        (leader) =>
          leader.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          leader.contact?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          leader.wechat?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredLeaders(filtered);
    } else {
      setFilteredLeaders(leaders);
    }
  }, [searchQuery, leaders]);

  const loadLeaders = async () => {
    try {
      setLoading(true);
      const data = await getLeaders();
      setLeaders(data);
      setFilteredLeaders(data);
    } catch (error) {
      console.error('加载领队列表失败:', error);
      toast.error('加载领队列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (leader: Leader) => {
    // 添加到最近使用列表
    addRecentLeader(leader.id);
    onSelect(leader);
    onOpenChange(false);
  };

  const handleClear = () => {
    onSelect(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>选择介绍人(领队)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索领队姓名、联系方式或微信..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* 清除选择按钮 */}
          {selectedLeader && (
            <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>{selectedLeader.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">当前选择: {selectedLeader.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedLeader.contact}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleClear}>
                <X className="h-4 w-4 mr-1" />
                清除
              </Button>
            </div>
          )}

          {/* 领队列表 */}
          <div className="flex-1 overflow-y-auto border border-border rounded-lg">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 bg-muted" />
                ))}
              </div>
            ) : filteredLeaders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {searchQuery ? '未找到匹配的领队' : '暂无领队数据'}
              </div>
            ) : (
              <div>
                {/* 最近使用 */}
                {!searchQuery && recentLeaders.length > 0 && (
                  <div>
                    <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-4 py-2 text-sm font-medium text-muted-foreground flex items-center gap-2 border-b border-border z-20">
                      <Clock className="h-4 w-4" />
                      最近使用
                    </div>
                    <div className="divide-y divide-border">
                      {recentLeaders.map((leader) => (
                        <div
                          key={leader.id}
                          className="p-4 hover:bg-accent cursor-pointer transition-colors"
                          onClick={() => handleSelect(leader)}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12">
                              <AvatarFallback>{leader.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground">{leader.name}</p>
                              <div className="flex gap-4 text-sm text-muted-foreground">
                                <span>📱 {leader.contact}</span>
                                {leader.wechat && <span>💬 {leader.wechat}</span>}
                                {leader.gender && <span>{leader.gender}</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 全部领队 */}
                {!searchQuery && otherLeaders.length > 0 && (
                  <div>
                    <div className={`sticky bg-muted/80 backdrop-blur-sm px-4 py-2 text-sm font-medium text-muted-foreground border-b border-border z-10 ${recentLeaders.length > 0 ? 'top-[42px]' : 'top-0'}`}>
                      全部领队
                    </div>
                    <div className="divide-y divide-border">
                      {otherLeaders.map((leader) => (
                        <div
                          key={leader.id}
                          className="p-4 hover:bg-accent cursor-pointer transition-colors"
                          onClick={() => handleSelect(leader)}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12">
                              <AvatarFallback>{leader.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground">{leader.name}</p>
                              <div className="flex gap-4 text-sm text-muted-foreground">
                                <span>📱 {leader.contact}</span>
                                {leader.wechat && <span>💬 {leader.wechat}</span>}
                                {leader.gender && <span>{leader.gender}</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 搜索结果 */}
                {searchQuery && (
                  <div className="divide-y divide-border">
                    {filteredLeaders.map((leader) => (
                      <div
                        key={leader.id}
                        className="p-4 hover:bg-accent cursor-pointer transition-colors"
                        onClick={() => handleSelect(leader)}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback>{leader.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground">{leader.name}</p>
                            <div className="flex gap-4 text-sm text-muted-foreground">
                              <span>📱 {leader.contact}</span>
                              {leader.wechat && <span>💬 {leader.wechat}</span>}
                              {leader.gender && <span>{leader.gender}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
