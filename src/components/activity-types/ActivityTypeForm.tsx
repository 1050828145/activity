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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { ActivityType } from '@/types';

const activityTypeSchema = z.object({
  name: z.string().min(1, '请输入类型名称'),
  description: z.string().optional(),
});

type ActivityTypeFormValues = z.infer<typeof activityTypeSchema>;

interface ActivityTypeFormProps {
  activityType?: ActivityType;
  onSubmit: (data: ActivityTypeFormValues) => Promise<void>;
  onCancel: () => void;
}

export default function ActivityTypeForm({ activityType, onSubmit, onCancel }: ActivityTypeFormProps) {
  const form = useForm<ActivityTypeFormValues>({
    resolver: zodResolver(activityTypeSchema),
    defaultValues: activityType
      ? {
          name: activityType.name,
          description: activityType.description || '',
        }
      : {
          name: '',
          description: '',
        },
  });

  const handleSubmit = async (data: ActivityTypeFormValues) => {
    await onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>类型名称 *</FormLabel>
              <FormControl>
                <Input placeholder="请输入类型名称" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>描述</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="请输入类型描述"
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button type="submit">
            保存
          </Button>
        </div>
      </form>
    </Form>
  );
}
