import { useState, useEffect, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import type { Leader } from '@/types';

interface LeaderSelectorProps {
  allLeaders: Leader[];
  selectedLeaders: Leader[];
  onUpdate: (leaders: Leader[]) => void;
}

export default function LeaderSelector({ allLeaders, selectedLeaders, onUpdate }: LeaderSelectorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [tempSelected, setTempSelected] = useState<string[]>([]);
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (dialogOpen) {
      setTempSelected(selectedLeaders.map(l => l.id));
    }
  }, [dialogOpen, selectedLeaders]);

  const filteredLeaders = allLeaders.filter(leader =>
    leader.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    leader.contact.includes(searchTerm)
  );

  const handleToggle = (leaderId: string) => {
    setTempSelected(prev =>
      prev.includes(leaderId)
        ? prev.filter(id => id !== leaderId)
        : [...prev, leaderId]
    );
  };

  const handleConfirm = () => {
    const newSelected = allLeaders.filter(l => tempSelected.includes(l.id));
    onUpdate(newSelected);
    setDialogOpen(false);
  };

  const handleRemove = (leaderId: string) => {
    setRemoveConfirmId(leaderId);
  };

  const confirmRemove = () => {
    if (!removeConfirmId) return;
    const newSelected = selectedLeaders.filter(l => l.id !== removeConfirmId);
    onUpdate(newSelected);
    setRemoveConfirmId(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">活动领队</h3>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          添加领队
        </Button>
      </div>

      {selectedLeaders.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-4 text-center">
          暂无领队,点击上方按钮添加
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {selectedLeaders.map((leader) => (
            <Badge
              key={leader.id}
              variant="secondary"
              className="pl-3 pr-1 py-1 flex items-center gap-2"
            >
              <span>{leader.name}</span>
              <button
                onClick={() => handleRemove(leader.id)}
                className="hover:bg-muted rounded-sm p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>选择领队</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="搜索领队姓名或联系方式..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <div className="max-h-96 overflow-y-auto border border-border rounded-lg">
              {filteredLeaders.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  {searchTerm ? '未找到匹配的领队' : '暂无领队数据'}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredLeaders.map((leader) => (
                    <div
                      key={leader.id}
                      className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer"
                      onClick={() => handleToggle(leader.id)}
                    >
                      <Checkbox
                        checked={tempSelected.includes(leader.id)}
                        onCheckedChange={() => handleToggle(leader.id)}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-foreground">{leader.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {leader.contact}
                          {leader.wechat && ` · 微信: ${leader.wechat}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-2">
              <div className="text-sm text-muted-foreground">
                已选择 {tempSelected.length} 位领队
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleConfirm}>
                  确定
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 移除领队确认弹窗 */}
      <AlertDialog open={!!removeConfirmId} onOpenChange={(open) => { if (!open) setRemoveConfirmId(null); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>确认移除领队</AlertDialogTitle>
            <AlertDialogDescription>
              确定要将领队「{selectedLeaders.find(l => l.id === removeConfirmId)?.name}」从活动中移除吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>移除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
