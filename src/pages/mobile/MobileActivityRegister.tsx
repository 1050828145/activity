import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { Calendar, MapPin, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { getActivity, createPerson, addActivityParticipants } from '@/db/api';
import type { Activity } from '@/types';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  '待确认': 'bg-muted',
  '已确认': 'bg-primary',
  '进行中': 'bg-chart-1',
  '已完成': 'bg-chart-2',
  '已取消': 'bg-red-500',
};

interface RegisterForm {
  name: string;
  contact: string;
  age?: number;
  gender?: string;
}

export default function MobileActivityRegister() {
  const { id } = useParams<{ id: string }>();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [registeredName, setRegisteredName] = useState('');
  const [registeredContact, setRegisteredContact] = useState('');

  const form = useForm<RegisterForm>({
    defaultValues: {
      name: '',
      contact: '',
      age: undefined,
      gender: undefined,
    },
  });

  useEffect(() => {
    loadActivity();
  }, [id]);

  const loadActivity = async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      const data = await getActivity(id);
      setActivity(data);
      // 设置网页标题为活动名称
      if (data) {
        document.title = `${data.name} - 活动报名`;
      }
    } catch (error) {
      console.error('加载活动失败:', error);
      toast.error('加载活动失败');
      document.title = '活动报名';
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: RegisterForm) => {
    if (!id) return;

    try {
      setSubmitting(true);

      // 创建人员
      const personData = await createPerson({
        name: values.name,
        contact: values.contact,
        age: values.age,
        gender: values.gender || '未知',
        id_number: '',
        expertise: '',
        notes: '通过报名页面注册',
      });

      // 添加到活动参与
      await addActivityParticipants(id, [personData.id], 'qrcode');

      // 保存报名信息用于成功页面展示
      setRegisteredName(values.name);
      setRegisteredContact(values.contact);
      setSuccess(true);
      toast.success('报名成功！', { position: 'top-right' });
    } catch (error: any) {
      console.error('报名失败:', error);
      // 直接显示后端返回的错误消息
      toast.error(error.message || '报名失败，请重试', { position: 'top-right' });
    } finally {
      setSubmitting(false);
    }
  };

  // 缩略电话号码（显示前3位和后4位）
  const maskPhone = (phone: string) => {
    if (phone.length === 11) {
      return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
    }
    return phone;
  };

  if (!activity) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-3">
        <Card className="w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">
              {loading ? '加载中...' : '活动不存在'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-3">
        <Card className="w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-primary mx-auto" />
            <h2 className="text-2xl font-bold">报名成功！</h2>
            <div className="space-y-2">
              <p className="text-muted-foreground">
                您已成功报名参加 <span className="font-semibold text-foreground">{activity.name}</span>
              </p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>姓名：<span className="text-foreground">{registeredName}</span></p>
                <p>联系方式：<span className="text-foreground">{maskPhone(registeredContact)}</span></p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              我们会尽快与您联系，请保持手机畅通
            </p>
            <Button
              onClick={() => {
                setSuccess(false);
                setRegisteredName('');
                setRegisteredContact('');
                form.reset();
              }}
              className="w-full"
            >
              继续报名
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* 活动信息卡片 - 固定高度30% */}
      <div className="h-[30vh] flex-shrink-0 p-3 pb-0">
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-3 flex-shrink-0">
            <CardTitle className="text-lg">{activity.name}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto pt-0 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="line-clamp-1">{activity.start_date}</span>
              {activity.end_date && <span className="line-clamp-1">至 {activity.end_date}</span>}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="line-clamp-1">{activity.location}</span>
            </div>
            {activity.summary && (
              <div className="pt-2 border-t border-border">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{activity.summary}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 报名表单 - 占据剩余空间 */}
      <div className="flex-1 overflow-y-auto p-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">报名信息</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3">
                <FormField
                  control={form.control}
                  name="name"
                  rules={{ required: '请输入姓名' }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>姓名 *</FormLabel>
                      <FormControl>
                        <Input placeholder="请输入您的姓名" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contact"
                  rules={{
                    required: '请输入联系方式',
                    pattern: {
                      value: /^1[3-9]\d{9}$/,
                      message: '请输入有效的手机号',
                    },
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>联系方式 *</FormLabel>
                      <FormControl>
                        <Input placeholder="请输入手机号" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>年龄</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="请输入年龄"
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>性别</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="请选择性别" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="男">男</SelectItem>
                          <SelectItem value="女">女</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? '提交中...' : '提交报名'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground py-4">
          提交报名信息即表示您同意参加此活动
        </p>
      </div>
    </div>
  );
}
