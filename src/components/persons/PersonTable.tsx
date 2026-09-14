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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Edit, Trash2, Eye } from 'lucide-react';
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
import type { Person } from '@/types';

interface PersonTableProps {
  persons: Person[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onEdit: (person: Person) => void;
  onDelete: (id: string) => void;
  onView: (id: string) => void;
}

export default function PersonTable({ persons, selectedIds, onSelectionChange, onEdit, onDelete, onView }: PersonTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(persons.map(p => p.id));
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

  const isAllSelected = persons.length > 0 && selectedIds.length === persons.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < persons.length;

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
              <TableHead className="sticky left-12 bg-background z-10 whitespace-nowrap">姓名</TableHead>
              <TableHead className="whitespace-nowrap">联系方式</TableHead>
              <TableHead className="w-[80px]">性别</TableHead>
              <TableHead className="w-[80px]">年龄</TableHead>
              <TableHead className="w-[100px]">身高</TableHead>
              <TableHead className="w-[100px]">体重</TableHead>
              <TableHead className="min-w-[120px]">擅长领域</TableHead>
              <TableHead className="text-right w-[140px] sticky right-0 bg-background z-10 border-l border-border whitespace-nowrap">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {persons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  暂无人员数据
                </TableCell>
              </TableRow>
            ) : (
              persons.map((person) => (
                <TableRow key={person.id}>
                  <TableCell className="sticky left-0 bg-background z-10">
                    <Checkbox
                      checked={selectedIds.includes(person.id)}
                      onCheckedChange={(checked) => handleSelectOne(person.id, checked as boolean)}
                      aria-label={`选择 ${person.name}`}
                    />
                  </TableCell>
                  <TableCell className="sticky left-12 bg-background z-10">
                    <button
                      onClick={() => onEdit(person)}
                      className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={person.photo_url} alt={person.name} />
                        <AvatarFallback className="text-[10px]">{person.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-primary hover:underline whitespace-nowrap">{person.name}</span>
                    </button>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{person.contact}</TableCell>
                  <TableCell>{person.gender || '-'}</TableCell>
                  <TableCell>{person.age || '-'}</TableCell>
                  <TableCell>{person.height ? `${person.height}cm` : '-'}</TableCell>
                  <TableCell>{person.weight ? `${person.weight}kg` : '-'}</TableCell>
                  <TableCell className="max-w-[200px] break-words whitespace-normal text-xs">
                    {person.expertise || '-'}
                  </TableCell>
                  <TableCell className="text-right sticky right-0 bg-background z-10 border-l border-border">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onView(person.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onEdit(person)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setDeleteId(person.id)}
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
              此操作将永久删除该人员及其所有参与记录,无法恢复。确定要继续吗?
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
