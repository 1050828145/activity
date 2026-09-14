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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const batchUpdateSchema = z.object({
  gender: z.string().optional(),
  expertise: z.string().optional(),
});

type BatchUpdateFormValues = z.infer<typeof batchUpdateSchema>;

interface BatchUpdatePersonFormProps {
  onSubmit: (data: BatchUpdateFormValues) => Promise<void>;
  onCancel: () => void;
  count: number;
}

const genderOptions = ['男', '女', '其他'];

export default function BatchUpdatePersonForm({ onSubmit, onCancel, count }: BatchUpdatePersonFormProps) {
  const form = useForm<BatchUpdateFormValues>({
    resolver: zodResolver(batchUpdateSchema),
    defaultValues: {
      gender: '',
      expertise: '',
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
          将批量修改 {count} 条人员记录
        </div>

        <FormField
          control={form.control}
          name="gender"
          render={({ field }) => (
            <FormItem>
              <FormLabel>性别</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="选择要更新的性别" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {genderOptions.map((gender) => (
                    <SelectItem key={gender} value={gender}>
                      {gender}
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
          name="expertise"
          render={({ field }) => (
            <FormItem>
              <FormLabel>擅长领域</FormLabel>
              <FormControl>
                <Input placeholder="输入要更新的擅长领域" {...field} />
              </FormControl>
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
