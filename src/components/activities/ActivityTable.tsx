import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Edit, Trash2, Eye, Copy, Users, ChevronDown } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import type { Activity } from '@/types';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { userFriendlyMessages } from '@/lib/user-friendly-messages';
import { useTableColumns } from '@/hooks/use-table-columns';

interface ActivityTableProps {
  activities: Activity[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onEdit: (activity: Activity) => void;
  onDelete: (id: string) => void;
  onView: (id: string) => void;
  onManageParticipants: (activity: Activity) => void;
}

const statusColors: Record<string, string> = {
  '待确认': 'bg-muted text-muted-foreground',
  '已确认': 'bg-primary text-primary-foreground',
  '进行中': 'bg-chart-1 text-primary-foreground',
  '已完成': 'bg-chart-2 text-primary-foreground',
  '已取消': 'bg-destructive text-destructive-foreground',
};

export default function ActivityTable({ 
  activities, 
  selectedIds, 
  onSelectionChange, 
  onEdit, 
  onDelete, 
  onView,
  onManageParticipants
}: ActivityTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { columns } = useTableColumns('activities');

  // 渲染单元格内容
  const renderCell = (activity: Activity, columnKey: string) => {
    switch (columnKey) {
      case 'name':
        return (
          <button
            onClick={() => onView(activity.id)}
            className="hover:underline cursor-pointer text-left font-medium text-primary"
          >
            {activity.name}
          </button>
        );
      
      case 'activity_type_name':
        return activity.activity_type_name ? (
          <Badge variant="secondary" className="whitespace-nowrap">
            {activity.activity_type_name}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        );
      
      case 'status':
        return (
          <Badge className={cn("whitespace-nowrap", statusColors[activity.status] || 'bg-muted')}>
            {activity.status}
          </Badge>
        );
      
      case 'start_date':
        return (
          <span className="whitespace-nowrap">
            {activity.type === '长期' ? (
              <span className="text-muted-foreground italic">长期活动</span>
            ) : (
              activity.start_date ? format(new Date(activity.start_date), 'yyyy-MM-dd', { locale: zhCN }) : '-'
            )}
          </span>
        );
      
      case 'location':
        return <span className="max-w-[300px] break-words whitespace-normal">{activity.location}</span>;
      
      case 'required_people':
        return activity.required_people || '-';
      
      case 'participant_count':
        return (
          <Badge variant="secondary" className={cn(
            "font-semibold",
            activity.required_people > 0 && (activity.participant_count || 0) >= activity.required_people 
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
              : ""
          )}>
            {activity.participant_count || 0}
          </Badge>
        );
      
      case 'part_time_salary':
        return activity.part_time_salary ? `¥${activity.part_time_salary}` : '-';
      
      case 'per_head_fee':
        return activity.per_head_fee ? `¥${activity.per_head_fee}` : '-';
      
      case 'deposit':
        return activity.deposit ? `¥${activity.deposit}` : '-';
      
      case 'registration_method':
        return (
          <div className="max-w-[200px] break-words whitespace-normal">
            {activity.registration_method || '-'}
          </div>
        );
      
      case 'notes':
        return (
          <div className="max-w-[200px] break-words whitespace-normal">
            {activity.notes || '-'}
          </div>
        );
      
      default:
        return '-';
    }
  };

  const handleCopyContent = async (activity: Activity) => {
    if (!activity.content) {
      toast.error(userFriendlyMessages.data.empty('活动内容'));
      return;
    }

    try {
      await navigator.clipboard.writeText(activity.content);
      toast.success(userFriendlyMessages.success.copied('活动内容'));
    } catch (error) {
      console.error('复制失败:', error);
      toast.error(userFriendlyMessages.operation.copyFailed);
    }
  };

  const handleCopyRegistrationMethod = async (activity: Activity) => {
    if (!activity.registration_method) {
      toast.error(userFriendlyMessages.data.empty('报名方式'));
      return;
    }

    try {
      await navigator.clipboard.writeText(activity.registration_method);
      toast.success(userFriendlyMessages.success.copied('报名方式'));
    } catch (error) {
      console.error('复制失败:', error);
      toast.error(userFriendlyMessages.operation.copyFailed);
    }
  };

  const handleDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(activities.map(a => a.id));
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

  const isAllSelected = activities.length > 0 && selectedIds.length === activities.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < activities.length;

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
              {columns.map((column) => (
                <TableHead 
                  key={column.column_key} 
                  className="whitespace-nowrap"
                  style={column.width ? { width: `${column.width}px`, minWidth: `${column.width}px` } : undefined}
                >
                  {column.column_label}
                </TableHead>
              ))}
              <TableHead className="text-right w-[180px] sticky right-0 bg-background z-10 border-l border-border whitespace-nowrap">
                操作
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 2} className="text-center text-muted-foreground py-8">
                  暂无活动数据
                </TableCell>
              </TableRow>
            ) : (
              activities.map((activity) => (
                <TableRow key={activity.id}>
                  <TableCell className="sticky left-0 bg-background z-10">
                    <Checkbox
                      checked={selectedIds.includes(activity.id)}
                      onCheckedChange={(checked) => handleSelectOne(activity.id, checked as boolean)}
                      aria-label={`选择 ${activity.name}`}
                    />
                  </TableCell>
                  {columns.map((column) => (
                    <TableCell key={column.column_key}>
                      {renderCell(activity, column.column_key)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right sticky right-0 bg-background z-10 border-l border-border">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onView(activity.id)}
                        title="查看详情"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onManageParticipants(activity)}
                        title="参与人员"
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            title="复制信息"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => handleCopyContent(activity)}
                            disabled={!activity.content}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            复制活动内容
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleCopyRegistrationMethod(activity)}
                            disabled={!activity.registration_method}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            复制报名方式
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onEdit(activity)}
                        title="编辑"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setDeleteId(activity.id)}
                        title="删除"
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
              此操作将永久删除该活动及其所有参与记录,无法恢复。确定要继续吗?
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
