import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Edit, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import type { Leader } from '@/types';

interface LeaderTableProps {
  leaders: Leader[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onEdit: (leader: Leader) => void;
  onDelete: (id: string) => void;
}

export default function LeaderTable({ leaders, selectedIds, onSelectionChange, onEdit, onDelete }: LeaderTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(leaders.map(l => l.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter(selectedId => selectedId !== id));
    }
  };

  const isAllSelected = leaders.length > 0 && selectedIds.length === leaders.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < leaders.length;

  return (
    <>
      <div className="rounded-md border border-border overflow-x-auto max-w-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 sticky left-0 bg-background z-10">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="全选"
                  className={isSomeSelected ? 'data-[state=checked]:bg-primary' : ''}
                />
              </TableHead>
              <TableHead className="w-[100px] sticky left-12 bg-background z-10 whitespace-nowrap">姓名</TableHead>
              <TableHead className="w-[80px]">性别</TableHead>
              <TableHead className="w-[80px]">年龄</TableHead>
              <TableHead className="w-[120px]">联系方式</TableHead>
              <TableHead className="w-[120px]">微信</TableHead>
              <TableHead className="w-[80px]">状态</TableHead>
              <TableHead className="min-w-[150px]">备注</TableHead>
              <TableHead className="text-right w-[100px] sticky right-0 bg-background z-10 border-l border-border whitespace-nowrap">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  暂无领队数据
                </TableCell>
              </TableRow>
            ) : (
              leaders.map((leader) => (
                <TableRow key={leader.id}>
                  <TableCell className="sticky left-0 bg-background z-10">
                    <Checkbox
                      checked={selectedIds.includes(leader.id)}
                      onCheckedChange={(checked) => handleSelectOne(leader.id, checked as boolean)}
                      aria-label={`选择 ${leader.name}`}
                    />
                  </TableCell>
                  <TableCell className="sticky left-12 bg-background z-10">
                    <button
                      onClick={() => onEdit(leader)}
                      className="font-medium text-primary hover:underline cursor-pointer text-left whitespace-nowrap"
                    >
                      {leader.name}
                    </button>
                  </TableCell>
                  <TableCell>{leader.gender || '-'}</TableCell>
                  <TableCell>{leader.age || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{leader.contact}</TableCell>
                  <TableCell className="max-w-[120px] truncate" title={leader.wechat || ''}>{leader.wechat || '-'}</TableCell>
                  <TableCell>
                    <span className={cn("whitespace-nowrap", leader.status === '工作' ? 'text-green-600' : 'text-muted-foreground')}>
                      {leader.status}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[300px] break-words whitespace-normal text-xs">{leader.notes || '-'}</TableCell>
                  <TableCell className="text-right sticky right-0 bg-background z-10 border-l border-border">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onEdit(leader)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setDeleteId(leader.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将永久删除该领队,无法恢复。确定要继续吗?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
