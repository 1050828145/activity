import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const statusOptions = ['待确认', '已确认', '已出席', '已合格', '未出席', '已取消'];

interface UpdateStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (status: string) => void;
  count: number;
  currentStatus?: string;
}

export default function UpdateStatusDialog({
  open,
  onOpenChange,
  onConfirm,
  count,
  currentStatus,
}: UpdateStatusDialogProps) {
  const [status, setStatus] = useState(currentStatus || '待确认');

  const handleConfirm = () => {
    onConfirm(status);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {count === 1 ? '修改参与状态' : `批量修改参与状态 (${count}条)`}
          </DialogTitle>
          <DialogDescription>
            {count === 1
              ? '请选择新的参与状态'
              : `将为选中的 ${count} 条参与记录更新状态`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="status">参与状态</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue placeholder="选择状态" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleConfirm}>确认修改</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
