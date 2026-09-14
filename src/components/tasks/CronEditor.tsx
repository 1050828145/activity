import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import cronstrue from 'cronstrue/i18n';
import CronParser from 'cron-parser';

interface CronEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function CronEditor({ value, onChange }: CronEditorProps) {
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [cronExpression, setCronExpression] = useState(value || '0 0 * * *');
  const [description, setDescription] = useState('');
  const [nextExecutions, setNextExecutions] = useState<string[]>([]);

  // 简单模式的状态
  const [simpleMode, setSimpleMode] = useState({
    type: 'daily', // daily, weekly, monthly, hourly, custom
    hour: '0',
    minute: '0',
    dayOfWeek: '1', // 1-7 (周一到周日)
    dayOfMonth: '1', // 1-31
  });

  useEffect(() => {
    setCronExpression(value || '0 0 * * *');
  }, [value]);

  useEffect(() => {
    try {
      // 生成描述
      const desc = cronstrue.toString(cronExpression, { locale: 'zh_CN' });
      setDescription(desc);

      // 计算下次执行时间
      const interval = CronParser.parse(cronExpression);
      const executions: string[] = [];
      for (let i = 0; i < 5; i++) {
        executions.push(interval.next().toString());
      }
      setNextExecutions(executions);
    } catch (error) {
      setDescription('无效的 Cron 表达式');
      setNextExecutions([]);
    }
  }, [cronExpression]);

  const handleSimpleModeChange = () => {
    let newCron = '';
    const { type, hour, minute, dayOfWeek, dayOfMonth } = simpleMode;

    switch (type) {
      case 'hourly':
        newCron = `${minute} * * * *`;
        break;
      case 'daily':
        newCron = `${minute} ${hour} * * *`;
        break;
      case 'weekly':
        newCron = `${minute} ${hour} * * ${dayOfWeek}`;
        break;
      case 'monthly':
        newCron = `${minute} ${hour} ${dayOfMonth} * *`;
        break;
      default:
        newCron = cronExpression;
    }

    setCronExpression(newCron);
    onChange(newCron);
  };

  useEffect(() => {
    if (mode === 'simple') {
      handleSimpleModeChange();
    }
  }, [simpleMode, mode]);

  const handleAdvancedChange = (newValue: string) => {
    setCronExpression(newValue);
    onChange(newValue);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cron 表达式编辑器</CardTitle>
        <CardDescription>
          设置任务的执行时间
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'simple' | 'advanced')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="simple">可视化编辑</TabsTrigger>
            <TabsTrigger value="advanced">高级编辑</TabsTrigger>
          </TabsList>

          <TabsContent value="simple" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>执行频率</Label>
                <Select
                  value={simpleMode.type}
                  onValueChange={(v) => setSimpleMode({ ...simpleMode, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">每小时</SelectItem>
                    <SelectItem value="daily">每天</SelectItem>
                    <SelectItem value="weekly">每周</SelectItem>
                    <SelectItem value="monthly">每月</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {simpleMode.type === 'hourly' && (
                <div className="space-y-2">
                  <Label>分钟</Label>
                  <Select
                    value={simpleMode.minute}
                    onValueChange={(v) => setSimpleMode({ ...simpleMode, minute: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 60 }, (_, i) => (
                        <SelectItem key={i} value={i.toString()}>
                          {i} 分
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(simpleMode.type === 'daily' || simpleMode.type === 'weekly' || simpleMode.type === 'monthly') && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>小时</Label>
                      <Select
                        value={simpleMode.hour}
                        onValueChange={(v) => setSimpleMode({ ...simpleMode, hour: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {i} 时
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>分钟</Label>
                      <Select
                        value={simpleMode.minute}
                        onValueChange={(v) => setSimpleMode({ ...simpleMode, minute: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 60 }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {i} 分
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}

              {simpleMode.type === 'weekly' && (
                <div className="space-y-2">
                  <Label>星期几</Label>
                  <Select
                    value={simpleMode.dayOfWeek}
                    onValueChange={(v) => setSimpleMode({ ...simpleMode, dayOfWeek: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">星期一</SelectItem>
                      <SelectItem value="2">星期二</SelectItem>
                      <SelectItem value="3">星期三</SelectItem>
                      <SelectItem value="4">星期四</SelectItem>
                      <SelectItem value="5">星期五</SelectItem>
                      <SelectItem value="6">星期六</SelectItem>
                      <SelectItem value="0">星期日</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {simpleMode.type === 'monthly' && (
                <div className="space-y-2">
                  <Label>日期</Label>
                  <Select
                    value={simpleMode.dayOfMonth}
                    onValueChange={(v) => setSimpleMode({ ...simpleMode, dayOfMonth: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {i + 1} 号
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Cron 表达式</Label>
              <Input
                value={cronExpression}
                onChange={(e) => handleAdvancedChange(e.target.value)}
                placeholder="0 0 * * *"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                格式：分 时 日 月 周 (例如：0 0 * * * 表示每天午夜执行)
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* 描述和预览 */}
        <div className="space-y-3 pt-4 border-t">
          <div>
            <Label className="text-sm font-medium">表达式</Label>
            <p className="text-sm font-mono bg-muted px-3 py-2 rounded-md mt-1">
              {cronExpression}
            </p>
          </div>

          <div>
            <Label className="text-sm font-medium">描述</Label>
            <p className="text-sm text-muted-foreground mt-1">
              {description}
            </p>
          </div>

          {nextExecutions.length > 0 && (
            <div>
              <Label className="text-sm font-medium">接下来 5 次执行时间</Label>
              <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                {nextExecutions.map((time, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <span className="text-xs bg-muted px-2 py-0.5 rounded">
                      {index + 1}
                    </span>
                    {new Date(time).toLocaleString('zh-CN')}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
