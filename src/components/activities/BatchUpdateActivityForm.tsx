import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEffect, useState } from 'react';
import { getActivityTypes } from '@/db/api';
import type { ActivityType } from '@/types';

const batchUpdateSchema = z.object({
  status: z.string().optional(),
  activity_type_id: z.string().optional(),
});

type BatchUpdateFormValues = z.infer<typeof batchUpdateSchema>;

interface BatchUpdateActivityFormProps {
  onSubmit: (data: BatchUpdateFormValues) => Promise<void>;
  onCancel: () => void;
  count: number;
}

const statusOptions = [
  '待确认',
  '已确认',
  '进行中',
  '已完成',
  '已取消',
];

export default function BatchUpdateActivityForm({ onSubmit, onCancel, count }: BatchUpdateActivityFormProps) {
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);

  useEffect(() => {
    loadActivityTypes();
  }, []);

  const loadActivityTypes = async () => {
    try {
      const types = await getActivityTypes();
      setActivityTypes(types);
    } catch (error) {
      console.error('加载活动类型失败:', error);
    }
  };

  const form = useForm<BatchUpdateFormValues>({
    resolver: zodResolver(batchUpdateSchema),
    defaultValues: {
      status: '',
      activity_type_id: '',
    },
  });

  const handleSubmit = async (data: BatchUpdateFormValues) => {
    // 过滤掉空值
    const updates = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== '' && value !== undefined)
    );
    await onSubmit(updates);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <div className="text-sm text-muted-foreground mb-4">
          将批量修改 {count} 条活动记录
        </div>

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>活动状态</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="选择要更新的状态（可选）" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="activity_type_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>活动类型</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="选择要更新的活动类型（可选）" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {activityTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button type="submit">
            批量更新
          </Button>
        </div>
      </form>
    </Form>
  );
}
