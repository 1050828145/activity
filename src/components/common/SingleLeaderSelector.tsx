import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import type { Leader } from '@/types';

interface SingleLeaderSelectorProps {
  allLeaders: Leader[];
  selectedLeaderId?: string;
  onSelect: (leaderId: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function SingleLeaderSelector({
  allLeaders,
  selectedLeaderId,
  onSelect,
  disabled = false,
  placeholder = '请选择领队',
}: SingleLeaderSelectorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [tempSelected, setTempSelected] = useState<string>('');

  useEffect(() => {
    if (dialogOpen) {
      setTempSelected(selectedLeaderId || '');
      setSearchTerm('');
    }
  }, [dialogOpen, selectedLeaderId]);

  const filteredLeaders = allLeaders.filter(leader =>
    leader.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    leader.contact.includes(searchTerm) ||
    (leader.wechat && leader.wechat.includes(searchTerm))
  );

  const handleConfirm = () => {
    if (tempSelected) {
      onSelect(tempSelected);
      setDialogOpen(false);
    }
  };

  const selectedLeader = allLeaders.find(l => l.id === selectedLeaderId);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start text-left font-normal"
        onClick={() => setDialogOpen(true)}
        disabled={disabled}
      >
        {selectedLeader ? (
          <span>{selectedLeader.name}</span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>选择领队</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索领队姓名、联系方式或微信..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="max-h-96 overflow-y-auto border border-border rounded-lg">
              {filteredLeaders.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  {searchTerm ? '未找到匹配的领队' : '暂无领队数据'}
                </div>
              ) : (
                <RadioGroup value={tempSelected} onValueChange={setTempSelected}>
                  <div className="divide-y divide-border">
                    {filteredLeaders.map((leader) => (
                      <div
                        key={leader.id}
                        className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer"
                        onClick={() => setTempSelected(leader.id)}
                      >
                        <RadioGroupItem value={leader.id} id={leader.id} />
                        <Label
                          htmlFor={leader.id}
                          className="flex-1 cursor-pointer"
                        >
                          <div className="font-medium text-foreground">{leader.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {leader.contact}
                            {leader.wechat && ` · 微信: ${leader.wechat}`}
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              )}
            </div>

            <div className="flex justify-between items-center pt-2">
              <div className="text-sm text-muted-foreground">
                {tempSelected ? `已选择: ${allLeaders.find(l => l.id === tempSelected)?.name}` : '请选择一位领队'}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleConfirm} disabled={!tempSelected}>
                  确定
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
