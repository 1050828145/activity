import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Sparkles, Check } from 'lucide-react';
import { createPerson, addActivityParticipants } from '@/db/api';
import { toast } from 'sonner';

interface ParsedPerson {
  name: string;
  contact: string;
  age?: number;
  gender?: string;
}

interface SmartPersonInputProps {
  activityId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function SmartPersonInput({
  activityId,
  onSuccess,
  onCancel,
}: SmartPersonInputProps) {
  const [inputText, setInputText] = useState('');
  const [parsedPersons, setParsedPersons] = useState<ParsedPerson[]>([]);
  const [saving, setSaving] = useState(false);

  // 智能解析文本
  const parseText = () => {
    if (!inputText.trim()) {
      toast.error('请输入人员信息');
      return;
    }

    const lines = inputText.split('\n').filter((line) => line.trim());
    const persons: ParsedPerson[] = [];

    for (const line of lines) {
      const person = parseLine(line);
      if (person) {
        persons.push(person);
      }
    }

    if (persons.length === 0) {
      toast.error('未能识别出有效的人员信息，请检查格式');
      return;
    }

    setParsedPersons(persons);
    toast.success(`成功识别 ${persons.length} 条人员信息`);
  };

  // 解析单行文本
  const parseLine = (line: string): ParsedPerson | null => {
    // 移除多余空格
    line = line.trim().replace(/\s+/g, ' ');

    // 提取手机号（11位数字）
    const phoneMatch = line.match(/1[3-9]\d{9}/);
    if (!phoneMatch) return null;
    const contact = phoneMatch[0];

    // 提取姓名（中文字符，2-4个字）
    const nameMatch = line.match(/[\u4e00-\u9fa5]{2,4}/);
    if (!nameMatch) return null;
    const name = nameMatch[0];

    // 提取年龄（1-3位数字，不是手机号的一部分）
    let age: number | undefined;
    // 先移除手机号，避免从手机号中提取数字
    const lineWithoutPhone = line.replace(contact, '');
    const ageMatches = lineWithoutPhone.match(/\d{1,3}/g);
    if (ageMatches) {
      for (const match of ageMatches) {
        const num = parseInt(match);
        // 年龄范围：1-150
        if (num > 0 && num < 150) {
          age = num;
          break;
        }
      }
    }

    // 提取性别
    let gender: string | undefined;
    if (line.includes('男') && !line.includes('女')) {
      gender = '男';
    } else if (line.includes('女') && !line.includes('男')) {
      gender = '女';
    }

    return { name, contact, age, gender };
  };

  // 更新解析后的人员信息
  const updatePerson = (index: number, field: keyof ParsedPerson, value: any) => {
    const updated = [...parsedPersons];
    updated[index] = { ...updated[index], [field]: value };
    setParsedPersons(updated);
  };

  // 删除某个人员
  const removePerson = (index: number) => {
    setParsedPersons(parsedPersons.filter((_, i) => i !== index));
  };

  // 保存所有人员
  const handleSave = async () => {
    if (parsedPersons.length === 0) {
      toast.error('没有可保存的人员信息');
      return;
    }

    try {
      setSaving(true);
      const createdPersonIds: string[] = [];

      // 先创建所有人员
      for (const person of parsedPersons) {
        try {
          // 创建人员
          const personData = await createPerson({
            name: person.name,
            contact: person.contact,
            age: person.age,
            gender: person.gender || '未知',
            id_number: '',
            expertise: '',
            notes: '',
          });

          createdPersonIds.push(personData.id);
        } catch (error: any) {
          // 如果是重复联系方式错误，尝试查找现有人员
          if (error.message?.includes('contact')) {
            console.log(`人员 ${person.name} 可能已存在，跳过`);
          } else {
            console.error(`保存人员 ${person.name} 失败:`, error);
          }
        }
      }

      // 批量添加到活动参与（自动赋值工资、押金、人头费等默认值）
      if (createdPersonIds.length > 0) {
        await addActivityParticipants(activityId, createdPersonIds);
        toast.success(`成功添加 ${createdPersonIds.length} 名参与人员`);
        onSuccess();
      } else {
        toast.error('添加失败，请检查人员是否已存在');
      }
    } catch (error) {
      console.error('保存失败:', error);
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 输入区域 */}
      {parsedPersons.length === 0 && (
        <div className="space-y-3">
          <div>
            <Label>批量输入人员信息</Label>
            <p className="text-xs text-muted-foreground mt-1">
              每行一个人员，支持多种格式：
            </p>
            <ul className="text-xs text-muted-foreground mt-1 space-y-1">
              <li>• 张三 13800138000 25</li>
              <li>• 李四，13900139000，30岁，男</li>
              <li>• 姓名：王五 电话：13700137000 年龄：28</li>
            </ul>
          </div>
          <Textarea
            placeholder="请输入人员信息，每行一个人员..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={8}
            className="font-mono text-sm"
          />
          <div className="flex gap-2">
            <Button onClick={parseText} className="flex-1">
              <Sparkles className="h-4 w-4 mr-2" />
              智能识别
            </Button>
            <Button variant="outline" onClick={onCancel}>
              取消
            </Button>
          </div>
        </div>
      )}

      {/* 识别结果 */}
      {parsedPersons.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>识别结果 ({parsedPersons.length}人)</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setParsedPersons([]);
                setInputText('');
              }}
            >
              重新输入
            </Button>
          </div>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {parsedPersons.map((person, index) => (
              <Card key={index}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <Badge variant="outline">#{index + 1}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removePerson(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">姓名</Label>
                      <Input
                        value={person.name}
                        onChange={(e) => updatePerson(index, 'name', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">电话</Label>
                      <Input
                        value={person.contact}
                        onChange={(e) => updatePerson(index, 'contact', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">年龄</Label>
                      <Input
                        type="number"
                        value={person.age || ''}
                        onChange={(e) =>
                          updatePerson(index, 'age', parseInt(e.target.value) || undefined)
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">性别</Label>
                      <Input
                        value={person.gender || ''}
                        onChange={(e) => updatePerson(index, 'gender', e.target.value)}
                        className="h-8 text-sm"
                        placeholder="未知"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              <Check className="h-4 w-4 mr-2" />
              {saving ? '保存中...' : `保存 ${parsedPersons.length} 人`}
            </Button>
            <Button variant="outline" onClick={onCancel} disabled={saving}>
              取消
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
