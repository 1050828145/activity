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
import PersonImageUpload from './PersonImageUpload';
import type { Person } from '@/types';

const personSchema = z.object({
  name: z.string().min(1, '请输入姓名'),
  contact: z.string().min(1, '请输入联系方式'),
  gender: z.string().optional(),
  age: z.coerce.number().optional(),
  height: z.coerce.number().optional(),
  weight: z.coerce.number().optional(),
  id_number: z.string().optional(),
  photo_url: z.string().optional(),
  expertise: z.string().optional(),
  notes: z.string().optional(),
});

type PersonFormValues = z.infer<typeof personSchema>;

interface PersonFormProps {
  person?: Person;
  onSubmit: (data: PersonFormValues) => Promise<void>;
  onCancel: () => void;
}

const genderOptions = ['男', '女', '其他'];

export default function PersonForm({ person, onSubmit, onCancel }: PersonFormProps) {
  const form = useForm<PersonFormValues>({
    resolver: zodResolver(personSchema),
    defaultValues: person
      ? {
          name: person.name,
          contact: person.contact,
          gender: person.gender || '',
          age: person.age || undefined,
          height: person.height || undefined,
          weight: person.weight || undefined,
          id_number: person.id_number || '',
          photo_url: person.photo_url || '',
          expertise: person.expertise || '',
          notes: person.notes || '',
        }
      : {
          name: '',
          contact: '',
          gender: '',
          age: undefined,
          height: undefined,
          weight: undefined,
          id_number: '',
          photo_url: '',
          expertise: '',
          notes: '',
        },
  });

  const handleSubmit = async (data: PersonFormValues) => {
    await onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="photo_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>照片</FormLabel>
              <FormControl>
                <PersonImageUpload
                  value={field.value}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>姓名</FormLabel>
                <FormControl>
                  <Input placeholder="请输入姓名" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contact"
            render={({ field }) => (
              <FormItem>
                <FormLabel>联系方式</FormLabel>
                <FormControl>
                  <Input placeholder="请输入联系方式" {...field} />
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择性别" />
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
            name="age"
            render={({ field }) => (
              <FormItem>
                <FormLabel>年龄</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="请输入年龄" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="height"
            render={({ field }) => (
              <FormItem>
                <FormLabel>身高(cm)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="请输入身高" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="weight"
            render={({ field }) => (
              <FormItem>
                <FormLabel>体重(kg)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="请输入体重" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="id_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>身份证号</FormLabel>
                <FormControl>
                  <Input placeholder="请输入身份证号" {...field} />
                </FormControl>
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
                  <Input placeholder="请输入擅长领域" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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
            {person ? '更新' : '创建'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
