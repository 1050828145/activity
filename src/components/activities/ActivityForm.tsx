import { useState, useRef, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { sendStreamRequest } from '@/utils/sseRequest';
import type { Activity } from '@/types';

const activitySchema = z.object({
  name: z.string().min(1, '请输入活动名称'),
  type: z.string().min(1, '请选择活动类型'),
  activity_type_id: z.string().optional(),
  status: z.string().min(1, '请选择活动状态'),
  start_date: z.string().optional().or(z.literal('')),
  end_date: z.string().optional().or(z.literal('')),
  payment_date: z.string().optional().or(z.literal('')),
  location: z.string().min(1, '请输入活动地点'),
  summary: z.string().optional(),
  content: z.string().optional(),
  registration_method: z.string().optional(),
  required_people: z.coerce.number().min(0, '人数不能为负数'),
  requirements: z.string().optional(),
  profit: z.coerce.number().optional(),
  part_time_salary: z.coerce.number().optional(),
  per_head_fee: z.coerce.number().optional(),
  deposit: z.coerce.number().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  // 短期活动必须填写开始日期
  if (data.type === '短期' && (!data.start_date || data.start_date === '')) {
    return false;
  }
  // 线上活动的日期字段可选，不需要验证
  return true;
}, {
  message: "短期活动必须填写开始日期",
  path: ["start_date"],
});

type ActivityFormValues = z.infer<typeof activitySchema>;

interface ActivityFormProps {
  activity?: Activity;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}

const statusOptions = [
  '待确认',
  '已确认',
  '进行中',
  '已完成',
  '已取消',
];

const typeOptions = [
  '短期',
  '长期',
  '线上',
];

export default function ActivityForm({ activity, onSubmit, onCancel }: ActivityFormProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [activityTypes, setActivityTypes] = useState<any[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  useEffect(() => {
    loadActivityTypes();
  }, []);

  const loadActivityTypes = async () => {
    try {
      const { getActivityTypes } = await import('@/db/api');
      const types = await getActivityTypes();
      setActivityTypes(types);
    } catch (error) {
      console.error('加载活动类型失败:', error);
    }
  };
  
  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: activity
      ? {
          name: activity.name,
          type: activity.type || '短期',
          activity_type_id: activity.activity_type_id || '',
          status: activity.status,
          start_date: activity.start_date || '',
          end_date: activity.end_date || '',
          payment_date: activity.payment_date || '',
          location: activity.location,
          summary: activity.summary || '',
          content: activity.content || '',
          registration_method: activity.registration_method || '',
          required_people: activity.required_people,
          requirements: activity.requirements || '',
          profit: activity.profit || undefined,
          part_time_salary: activity.part_time_salary || undefined,
          per_head_fee: activity.per_head_fee || undefined,
          deposit: activity.deposit || undefined,
          notes: activity.notes || '',
        }
      : {
          name: '',
          type: '短期',
          activity_type_id: '',
          status: '已确认',
          start_date: new Date().toISOString().split('T')[0],
          end_date: '',
          payment_date: '',
          location: '',
          summary: '',
          content: '',
          registration_method: '',
          required_people: 0,
          requirements: '',
          profit: undefined,
          part_time_salary: undefined,
          per_head_fee: undefined,
          deposit: undefined,
          notes: '',
        },
  });

  const activityType = form.watch('type');

  const handleGenerateSummary = async () => {
    const formValues = form.getValues();
    
    if (!formValues.name) {
      toast.error('请先填写活动名称');
      return;
    }

    setIsGenerating(true);
    abortControllerRef.current = new AbortController();

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    let generatedText = '';

    try {
      await sendStreamRequest({
        functionUrl: `${supabaseUrl}/functions/v1/generate-summary`,
        requestBody: {
          activityInfo: {
            name: formValues.name,
            date: formValues.start_date,
            location: formValues.location,
            content: formValues.content,
            required_people: formValues.required_people,
            requirements: formValues.requirements,
          }
        },
        supabaseAnonKey,
        onData: (data) => {
          try {
            const parsed = JSON.parse(data);
            const chunk = parsed.choices?.[0]?.delta?.content || '';
            generatedText += chunk;
            form.setValue('summary', generatedText);
          } catch (e) {
            // 忽略解析错误
          }
        },
        onComplete: () => {
          setIsGenerating(false);
          toast.success('活动概要生成成功');
        },
        onError: (error) => {
          console.error('生成失败:', error);
          setIsGenerating(false);
          toast.error('生成失败,请稍后重试');
        },
        signal: abortControllerRef.current.signal
      });
    } catch (error) {
      console.error('生成失败:', error);
      setIsGenerating(false);
      toast.error('生成失败,请稍后重试');
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
      toast.info('已停止生成');
    }
  };

  const handleSubmit = async (data: ActivityFormValues) => {
    // 清理数据：将空字符串转换为 undefined，让 API 层统一处理为 null
    const cleanedData = {
      ...data,
      activity_type_id: data.activity_type_id === 'none' ? undefined : data.activity_type_id,
      start_date: data.start_date || undefined,
      end_date: data.end_date || undefined,
      payment_date: data.payment_date || undefined,
      summary: data.summary || undefined,
      content: data.content || undefined,
      registration_method: data.registration_method || undefined,
      requirements: data.requirements || undefined,
      notes: data.notes || undefined,
    };
    await onSubmit(cleanedData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>活动名称</FormLabel>
                <FormControl>
                  <Input placeholder="请输入活动名称" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>活动类型</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择类型" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {typeOptions.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
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
                <FormLabel>活动分类</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || 'none'}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择活动分类（可选）" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">不选择</SelectItem>
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

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>活动状态</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择状态" />
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

          {activityType === '短期' && (
            <>
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>开始日期</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>结束日期</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          <FormField
            control={form.control}
            name="payment_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>发薪日期</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>活动地点</FormLabel>
                <FormControl>
                  <Input placeholder="请输入活动地点" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="required_people"
            render={({ field }) => (
              <FormItem>
                <FormLabel>需求人数</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="profit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>利润</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="0.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="part_time_salary"
            render={({ field }) => (
              <FormItem>
                <FormLabel>兼职工资</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="0.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="per_head_fee"
            render={({ field }) => (
              <FormItem>
                <FormLabel>人头费</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="0.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="deposit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>押金</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="0.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="summary"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>活动概要</FormLabel>
                {isGenerating ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleStopGeneration}
                    className="h-8"
                  >
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    停止生成
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateSummary}
                    className="h-8"
                  >
                    <Sparkles className="h-4 w-4 mr-1" />
                    AI生成
                  </Button>
                )}
              </div>
              <FormControl>
                <Textarea
                  placeholder="请输入活动概要或点击AI生成"
                  className="resize-none"
                  rows={2}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>活动内容</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="请输入活动内容"
                  className="min-h-20"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="registration_method"
          render={({ field }) => (
            <FormItem>
              <FormLabel>报名方式</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="请输入报名方式（如：微信报名、电话报名、现场报名等）"
                  className="resize-none"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="requirements"
          render={({ field }) => (
            <FormItem>
              <FormLabel>人员要求</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="请输入人员要求"
                  className="min-h-20"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>备注</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="请输入备注信息"
                  className="min-h-20"
                  {...field}
                />
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
            {activity ? '更新' : '创建'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
