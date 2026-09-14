import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  ChevronLeft,
  ChevronRight,
  FileDown,
  Loader2,
  Sparkles,
  Square,
  Send,
  RotateCcw,
  Bot,
  User as UserIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import SimpleMarkdown, {
  type RecommendedTaskData,
} from '@/components/common/SimpleMarkdown';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  getPromotionTasks,
  getPromotionTaskRecordsByDateRange,
  getPromotionTaskDetails,
  getActivities,
} from '@/db/api';
import type {
  PromotionTask,
  PromotionTaskRecord,
  PromotionTaskDetail,
  Activity,
} from '@/types';
import { formatDateStr } from '@/lib/promotion';
import { sendStreamRequest } from '@/lib/sse';
import { format } from 'date-fns';

// 时间段定义（依据实际推广时间的小时）
const TIME_PERIODS = [
  { key: 'morning', label: '上午', start: 6, end: 12 },
  { key: 'afternoon', label: '下午', start: 12, end: 18 },
  { key: 'evening', label: '晚上', start: 18, end: 24 },
  { key: 'night', label: '凌晨', start: 0, end: 6 },
] as const;

type PeriodKey = (typeof TIME_PERIODS)[number]['key'];

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function getPeriodKey(hour: number): PeriodKey {
  const found = TIME_PERIODS.find((p) => hour >= p.start && hour < p.end);
  return found ? found.key : 'night';
}

// 获取某日期所在周的周一（周一为一周开始）
function getMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=周日
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

interface PromoEntry {
  time: string; // 具体推广时间 HH:mm
  hour: number; // 具体推广时间（小时，0-23），用于散点图定位
  period: PeriodKey;
  taskName: string; // 所属推广任务名称
  activities: string[];
  conversions: number;
  channel?: string;
}

interface DayAgg {
  date: Date;
  dateStr: string;
  weekdayLabel: string;
  total: number;
  byPeriod: Record<PeriodKey, number>;
  entries: PromoEntry[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function PromotionWeeklyReport() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [aiStreaming, setAiStreaming] = useState(false);
  const aiAbortRef = useRef<AbortController | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const tasksRef = useRef<PromotionTask[]>([]);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  useEffect(() => {
    (async () => {
      try {
        const [tasksData, activitiesData] = await Promise.all([
          getPromotionTasks(),
          getActivities(),
        ]);
        tasksRef.current = tasksData;
        setActivities(activitiesData);
      } catch (error) {
        console.error('加载数据失败:', error);
        toast.error('加载任务数据失败');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const weekLabel = useMemo(() => {
    const s = `${weekStart.getFullYear()}年${weekStart.getMonth() + 1}月${weekStart.getDate()}日`;
    const e = `${weekEnd.getMonth() + 1}月${weekEnd.getDate()}日`;
    return `${s} ~ ${e}`;
  }, [weekStart, weekEnd]);

  const [aggregations, setAggregations] = useState<DayAgg[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const startStr = formatDateStr(weekStart);
      const endStr = formatDateStr(weekEnd);
      const records = await getPromotionTaskRecordsByDateRange(startStr, endStr);
      const details = await getPromotionTaskDetails(records.map((r) => r.id));

      const detailByRecordId = new Map<string, PromotionTaskDetail>();
      details.forEach((d) => detailByRecordId.set(d.record_id, d));
      const recordById = new Map<string, PromotionTaskRecord>();
      records.forEach((r) => recordById.set(r.id, r));
      const taskNameMap = new Map<string, string>();
      tasksRef.current.forEach((t) => taskNameMap.set(t.id, t.name));

      const days: DayAgg[] = [];
      for (let i = 0; i < 7; i++) {
        const date = addDays(weekStart, i);
        days.push({
          date,
          dateStr: formatDateStr(date),
          weekdayLabel: WEEKDAY_LABELS[i],
          total: 0,
          byPeriod: { morning: 0, afternoon: 0, evening: 0, night: 0 },
          entries: [],
        });
      }
      const dayMap = new Map(days.map((d) => [d.dateStr, d]));

      details.forEach((detail) => {
        const record = recordById.get(detail.record_id);
        if (!record) return;
        const day = dayMap.get(record.record_date);
        if (!day) return;
        const conv = detail.conversions || 0;
        day.total += conv;
        const hour = detail.actual_time ? new Date(detail.actual_time).getHours() : 12;
        const period = getPeriodKey(hour);
        day.byPeriod[period] += conv;
        const timeStr = detail.actual_time
          ? format(new Date(detail.actual_time), 'HH:mm')
          : '--:--';
        const acts = detail.activity_ids
          ? detail.activity_ids.split(',').map((id) => id.trim()).filter(Boolean)
          : [];
        day.entries.push({
          time: timeStr,
          hour,
          period,
          taskName: taskNameMap.get(record.task_id) || '未知任务',
          activities: acts,
          conversions: conv,
          channel: detail.channel || '',
        });
      });

      // 每天的条目按时间排序
      days.forEach((d) => d.entries.sort((a, b) => a.time.localeCompare(b.time)));

      setAggregations(days);
    } catch (error) {
      console.error('加载周报数据失败:', error);
      toast.error('加载周报数据失败');
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activityName = useCallback(
    (id: string) => activities.find((a) => a.id === id)?.name || '未知活动',
    [activities]
  );

  const periodLabel: Record<PeriodKey, string> = {
    morning: '上午',
    afternoon: '下午',
    evening: '晚上',
    night: '凌晨',
  };

  // 散点图数据：每个点 = 一次推广，x=具体时间(小时)，y=星期，点大小=转化人数，颜色=时段
  const scatterData = useMemo(() => {
    return aggregations.map((day, dayIdx) => ({
      period: dayIdx,
      data: day.entries.map((e) => ({
        x: e.hour + 0.5, // 中心对齐到该小时区间
        y: dayIdx,
        z: Math.max(e.conversions, 1) * 60, // 气泡大小（最小可见）
        conversions: e.conversions,
        time: e.time,
        period: e.period,
        weekday: day.weekdayLabel,
        date: `${day.date.getMonth() + 1}/${day.date.getDate()}`,
        activities: e.activities.map((id) => activityName(id)).join('、') || '未指定',
        channel: e.channel || '',
      })),
    }));
  }, [aggregations, activityName]);

  const hasScatterData = useMemo(
    () => scatterData.some((s) => s.data.length > 0),
    [scatterData]
  );

  const weekTotal = useMemo(
    () => aggregations.reduce((sum, d) => sum + d.total, 0),
    [aggregations]
  );

  // 推广次数（本周累计推广次数）
  const promoCount = useMemo(
    () => aggregations.reduce((s, d) => s + d.entries.length, 0),
    [aggregations]
  );
  const distinctTasks = useMemo(() => {
    const set = new Set<string>();
    aggregations.forEach((d) => d.entries.forEach((e) => set.add(e.taskName)));
    return set.size;
  }, [aggregations]);
  const distinctActivityCount = useMemo(() => {
    const set = new Set<string>();
    aggregations.forEach((d) =>
      d.entries.forEach((e) => e.activities.forEach((id) => set.add(id)))
    );
    return set.size;
  }, [aggregations]);
  const avgPerPromo = promoCount > 0 ? (weekTotal / promoCount).toFixed(1) : '0';

  const handleExportPDF = async () => {
    if (!contentRef.current) return;
    if (aggregations.length === 0) {
      toast.error('没有可导出的数据');
      return;
    }
    try {
      setExporting(true);
      toast.info('正在生成PDF，请稍候...');
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`推广任务转化周报_${weekLabel}.pdf`);
      toast.success('PDF导出成功！');
    } catch (error) {
      console.error('导出PDF失败:', error);
      toast.error('导出PDF失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  };

  const COLORS = {
    上午: 'hsl(var(--chart-1))',
    下午: 'hsl(var(--chart-2))',
    晚上: 'hsl(var(--chart-3))',
    凌晨: 'hsl(var(--chart-4))',
  };

  // 构建 AI 分析提示词（汇总本周数据，含任务/活动维度与具体推广时间）
  const buildPrompt = useCallback(() => {
    const lines = aggregations.map((day) => {
      const monthDay = `${day.date.getMonth() + 1}月${day.date.getDate()}日`;
      if (day.entries.length === 0) {
        return `${day.weekdayLabel}（${monthDay}）：无推广记录`;
      }
      const entryTexts = day.entries.map((e) => {
        const acts = e.activities.length
          ? e.activities.map((id) => activityName(id)).join('、')
          : '未指定活动';
        return `  - 【实际推广时间：${monthDay} ${e.time}（${periodLabel[e.period]}）】实际推广的任务「${e.taskName}」：推广活动「${acts}」${e.channel ? `，渠道「${e.channel}」` : ''}，转化 ${e.conversions} 人`;
      });
      return `${day.weekdayLabel}（${monthDay}，共推广 ${day.entries.length} 次，累计转化 ${day.total} 人）：\n${entryTexts.join('\n')}`;
    });

    const totalByPeriod = TIME_PERIODS.map((p) => {
      const sum = aggregations.reduce((s, d) => s + d.byPeriod[p.key], 0);
      return `${p.label} ${sum} 人`;
    }).join('，');

    // 按推广任务汇总
    const taskMap = new Map<string, { count: number; conv: number }>();
    // 按推广活动汇总（转化按活动数均摊，避免多活动重叠重复计入）
    const actMap = new Map<string, { count: number; conv: number }>();
    aggregations.forEach((day) =>
      day.entries.forEach((e) => {
        const t = taskMap.get(e.taskName) || { count: 0, conv: 0 };
        t.count += 1;
        t.conv += e.conversions;
        taskMap.set(e.taskName, t);
        const share = e.conversions / Math.max(e.activities.length, 1);
        e.activities.forEach((id) => {
          const name = activityName(id);
          const a = actMap.get(name) || { count: 0, conv: 0 };
          a.count += 1;
          a.conv += share;
          actMap.set(name, a);
        });
      })
    );

    const taskLines = Array.from(taskMap.entries())
      .sort((a, b) => b[1].conv - a[1].conv)
      .map(([name, v]) => `  - 任务「${name}」：累计推广 ${v.count} 次，转化 ${v.conv} 人`)
      .join('\n');
    const actLines = Array.from(actMap.entries())
      .sort((a, b) => b[1].conv - a[1].conv)
      .map(([name, v]) => `  - 活动「${name}」：推广 ${v.count} 次，均摊转化约 ${Math.round(v.conv)} 人`)
      .join('\n');

    return `你是一位专业的活动推广运营专家。以下是团队本周（${weekLabel}）真实的推广任务执行与转化记录，请基于这些具体数据进行深度复盘与分析，并给出下周可落地的推广建议。

【本周推广总览】：
- 累计推广次数：${promoCount} 次
- 累计转化人数：${weekTotal} 人（平均每次转化 ${avgPerPromo} 人）
- 涉及任务数：${distinctTasks} 个，涉及活动数：${distinctActivityCount} 个
- 各时间段转化汇总：${totalByPeriod}

【按推广任务汇总（次数 / 转化）】：
${taskLines || '  无'}

【按推广活动汇总（次数 / 转化）】：
${actLines || '  无'}

【每日每笔实际推广明细（精确到实际推广时间、所属时段、任务名称、推广活动、渠道、转化人数）】：
${lines.join('\n')}

====================
【核心分析与输出要求】：
1. 【强调实际推广时间】：在正文分析、讨论或举例说明某个任务时，**必须说明其具体的实际推广时间**，例如“在 9月12日 14:30（下午）实际推广的「每日下午群推」任务中...”，严格突显推广发生的具体时间与时段，切勿脱离时间只提任务名称！
2. 【任务与活动效果深度对比】：深入对比各个推广任务和推广活动的效果，点名分析表现最优秀和最薄弱的具体任务与活动。
3. 【时段与渠道效益分析】：梳理不同时间点（上午/下午/晚上/凌晨）及渠道的表现差异。
4. 【下周推荐任务（必须包含）】：必须设立专门的【下周推荐任务】章节，给出 2-4 条明确的下周推广任务建议。
为了让系统能在每一条推荐任务后面直接渲染「生成任务」按钮，**在每一条推荐任务的文本介绍后，必须紧跟一个独立的 \`\`\`task 代码块**，JSON 结构如下（务必使用 task 作为代码块语言）：
\`\`\`task
{
  "name": "推荐的任务名称",
  "promotion_time": "15:00:00",
  "cycle_type": "长期任务",
  "activity_names": "关联活动名称（如有时）",
  "notes": "推荐理由简述"
}
\`\`\`
（注：cycle_type 可选 "长期任务"、"短期任务" 或 "周期任务"；promotion_time 格式为 HH:mm:ss）

请使用结构清晰、条理分明的中文输出，使用粗体和项目符号突出重点。`;
  }, [
    aggregations,
    weekLabel,
    weekTotal,
    promoCount,
    avgPerPromo,
    distinctTasks,
    distinctActivityCount,
    activityName,
  ]);

  const handleGenerateTask = useCallback(
    (task: RecommendedTaskData) => {
      toast.success(`已提取推荐任务参数「${task.name}」，正在前往任务设置...`);
      navigate('/promotion/task-settings', {
        state: {
          openNewTask: true,
          prefillTask: task,
        },
      });
    },
    [navigate]
  );

  // 触发首次分析或重新分析
  const handleAnalyze = async () => {
    if (aiStreaming) {
      aiAbortRef.current?.abort();
      setAiStreaming(false);
      return;
    }
    if (aggregations.length === 0) {
      toast.error('当前周暂无数据，无法分析');
      return;
    }

    const prompt = buildPrompt();
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: prompt,
    };
    const assistantMsgId = `a-${Date.now() + 1}`;
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
    };

    setMessages([userMsg, assistantMsg]);
    setAiStreaming(true);
    aiAbortRef.current = new AbortController();

    await sendStreamRequest({
      functionUrl: `${supabaseUrl}/functions/v1/wenxin-text-generation`,
      requestBody: { messages: [{ role: 'user', content: prompt }] },
      supabaseAnonKey,
      signal: aiAbortRef.current.signal,
      onData: (data) => {
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          const chunk = parsed.choices?.[0]?.delta?.content ?? '';
          if (chunk) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, content: m.content + chunk } : m
              )
            );
          }
        } catch {
          // 跳过无法解析的帧
        }
      },
      onComplete: () => {
        setAiStreaming(false);
        setTimeout(() => {
          chatScrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
      },
      onError: (err) => {
        setAiStreaming(false);
        console.error('AI分析失败:', err);
        toast.error(`AI 分析失败: ${err.message || '网络或接口异常'}`);
      },
    });
  };

  // 支持上下文追问多轮对话
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text) return;
    if (aiStreaming) {
      toast.info('AI 正在回复中，请稍候或点击停止');
      return;
    }

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
    };
    const assistantMsgId = `a-${Date.now() + 1}`;
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
    };

    const nextMessages = [...messages, userMsg, assistantMsg];
    setMessages(nextMessages);
    setInputMessage('');
    setAiStreaming(true);
    aiAbortRef.current = new AbortController();

    // 组织对话上下文历史发给大模型
    const apiMessages = nextMessages.slice(0, -1).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    await sendStreamRequest({
      functionUrl: `${supabaseUrl}/functions/v1/wenxin-text-generation`,
      requestBody: { messages: apiMessages },
      supabaseAnonKey,
      signal: aiAbortRef.current.signal,
      onData: (data) => {
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          const chunk = parsed.choices?.[0]?.delta?.content ?? '';
          if (chunk) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, content: m.content + chunk } : m
              )
            );
          }
        } catch {
          // 跳过帧
        }
      },
      onComplete: () => {
        setAiStreaming(false);
        setTimeout(() => {
          chatScrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
      },
      onError: (err) => {
        setAiStreaming(false);
        console.error('追问回复失败:', err);
        toast.error(`回复失败: ${err.message || '网络或接口异常'}`);
      },
    });
  };

  const handleClearChat = () => {
    if (aiStreaming) {
      aiAbortRef.current?.abort();
      setAiStreaming(false);
    }
    setMessages([]);
    setInputMessage('');
    toast.info('已清空对话记录');
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4 mb-6 border-b">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">推广任务转化周报</h1>
            <p className="text-sm text-muted-foreground mt-1">
              按周查看每天各时间段的转化人数及推广活动列表，支持切换周次与导出PDF
            </p>
          </div>
          <Button onClick={handleExportPDF} disabled={exporting || loading} variant="secondary">
            {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
            导出PDF
          </Button>
        </div>
      </div>

      <div ref={contentRef} className="space-y-6">
        {/* 周切换 */}
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              disabled={loading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              上一周
            </Button>
            <div className="text-center min-w-0">
              <p className="font-semibold text-base">{weekLabel}</p>
              <p className="text-xs text-muted-foreground">本周推广 {promoCount} 次 · 转化 {weekTotal} 人</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              disabled={loading}
            >
              下一周
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>

        {/* 关键指标 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: '推广次数', value: `${promoCount} 次`, hint: '本周累计推广次数' },
            { label: '转化人数', value: `${weekTotal} 人`, hint: '本周累计转化' },
            { label: '平均每次转化', value: `${avgPerPromo} 人`, hint: '转化 ÷ 推广次数' },
            { label: '涉及任务 / 活动', value: `${distinctTasks} / ${distinctActivityCount}`, hint: '任务数 / 活动数' },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold mt-1">{s.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{s.hint}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 散点图：横轴=具体推广时间，纵轴=星期，气泡大小=转化人数，颜色=时段 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">每日各时段推广转化分布</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              横轴为当天具体推广时间（0-24 点），气泡越大表示转化人数越多，颜色区分上午 / 下午 / 晚上 / 凌晨四个时段
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-72 w-full" />
            ) : !hasScatterData ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                本周暂无推广转化数据
              </div>
            ) : (
              <div className="w-full min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height={360}>
                  <ScatterChart margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name="时间"
                      domain={[0, 24]}
                      ticks={[0, 3, 6, 9, 12, 15, 18, 21, 24]}
                      tickFormatter={(v: number) => `${v}:00`}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      label={{
                        value: '推广时间',
                        position: 'insideBottom',
                        offset: -2,
                        style: { fontSize: 12, fill: 'hsl(var(--muted-foreground))' },
                      }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name="星期"
                      domain={[-0.5, 6.5]}
                      ticks={[0, 1, 2, 3, 4, 5, 6]}
                      tickFormatter={(_v: number, i: number) => WEEKDAY_LABELS[i]}
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      width={48}
                      allowDecimals={false}
                    />
                    <ZAxis type="number" dataKey="z" range={[60, 600]} name="转化人数" />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const d = payload[0].payload as {
                          time: string;
                          weekday: string;
                          date: string;
                          period: PeriodKey;
                          conversions: number;
                          activities: string;
                          channel: string;
                        };
                        return (
                          <div className="rounded-lg border bg-popover p-3 text-xs shadow-md max-w-[240px]">
                            <p className="font-semibold text-foreground mb-1">
                              {d.weekday}（{d.date}）{d.time}
                            </p>
                            <p className="text-muted-foreground">
                              时段：<span className="text-foreground">{periodLabel[d.period]}</span>
                            </p>
                            <p className="text-muted-foreground">
                              转化：<span className="text-foreground">{d.conversions} 人</span>
                            </p>
                            <p className="text-muted-foreground break-words">
                              活动：<span className="text-foreground">{d.activities}</span>
                            </p>
                            {d.channel && (
                              <p className="text-muted-foreground break-words">
                                渠道：<span className="text-foreground">{d.channel}</span>
                              </p>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Legend
                      content={() => (
                        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 text-xs">
                          {TIME_PERIODS.map((p) => (
                            <span key={p.key} className="flex items-center gap-1.5">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: COLORS[periodLabel[p.key]] }}
                              />
                              <span className="text-muted-foreground">
                                {p.label}（{p.start}:00-{p.end}:00）
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    />
                    <Scatter data={scatterData.flatMap((s) => s.data)} isAnimationActive={false}>
                      {scatterData
                        .flatMap((s) => s.data)
                        .map((point, idx) => (
                          <Cell
                            key={idx}
                            fill={COLORS[periodLabel[point.period]]}
                            fillOpacity={0.75}
                          />
                        ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 每日推广活动列表（具体时间 + 时段分组） */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">每日推广明细（具体时间 / 时段）</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {aggregations.map((day) => {
                  const hasData = day.entries.length > 0;
                  const activePeriods = TIME_PERIODS.filter((p) =>
                    day.entries.some((e) => e.period === p.key)
                  );
                  return (
                    <div key={day.dateStr} className="rounded-lg border bg-card p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{day.weekdayLabel}</span>
                        <span className="text-xs text-muted-foreground">
                          {day.date.getMonth() + 1}月{day.date.getDate()}日
                        </span>
                        <div className="ml-auto flex items-center gap-1.5 shrink-0">
                          <Badge variant="outline" className="text-xs">
                            推广 {day.entries.length} 次
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            转化 {day.total} 人
                          </Badge>
                        </div>
                      </div>
                      {!hasData ? (
                        <p className="mt-2 text-sm text-muted-foreground">当天无推广记录</p>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {activePeriods.map((p) => {
                            const periodEntries = day.entries.filter((e) => e.period === p.key);
                            return (
                              <div key={p.key}>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="text-xs font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded">
                                    {p.label}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    转化 {day.byPeriod[p.key]} 人
                                  </span>
                                </div>
                                <div className="space-y-1.5 pl-1">
                                  {periodEntries.map((e, idx) => (
                                    <div
                                      key={idx}
                                      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                                    >
                                      <span className="font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">
                                        {e.time}
                                      </span>
                                      <div className="flex flex-wrap gap-1 min-w-0">
                                        {e.activities.length ? (
                                          e.activities.map((id) => (
                                            <Badge key={id} variant="outline" className="text-xs">
                                              {activityName(id)}
                                            </Badge>
                                          ))
                                        ) : (
                                          <span className="text-xs text-muted-foreground">未指定活动</span>
                                        )}
                                      </div>
                                      {e.channel && (
                                        <span className="text-xs text-muted-foreground">
                                          渠道：{e.channel}
                                        </span>
                                      )}
                                      <span className="text-xs text-muted-foreground ml-auto shrink-0">
                                        转化 {e.conversions}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI 推广建议分析与上下文对话 */}
        <Card className="border-primary/20 shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0 pb-3 border-b">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                AI 推广建议分析与策略对话
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                结合具体任务与实际推广时间深度复盘，生成下周推荐任务并支持多轮对话追问
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {aiStreaming ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    aiAbortRef.current?.abort();
                    setAiStreaming(false);
                  }}
                  className="text-xs"
                >
                  <Square className="h-3.5 w-3.5 mr-1" />
                  停止生成
                </Button>
              ) : (
                <>
                  {messages.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleClearChat}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      清空对话
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleAnalyze}
                    disabled={loading}
                    className="text-xs"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    {messages.length > 0 ? '重新分析' : 'AI 分析推广建议'}
                  </Button>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {messages.length === 0 && !aiStreaming ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h4 className="font-medium text-foreground text-sm mb-1">
                  基于本周数据智能生成下周推广方案
                </h4>
                <p className="text-xs text-muted-foreground max-w-md mb-4">
                  AI 将根据每个任务的具体推广时间、各活动转化表现进行深度复盘，给出具体的下周推荐任务，并支持一键生成任务。
                </p>
                <Button size="sm" onClick={handleAnalyze} disabled={loading}>
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  开始生成本周分析与建议
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 消息对话列表 */}
                <div className="space-y-4">
                  {messages.map((msg, idx) => {
                    if (msg.role === 'user') {
                      // 第一条是系统生成的大 prompt，显示为汇总卡片
                      if (idx === 0) {
                        return (
                          <div
                            key={msg.id}
                            className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground flex items-center justify-between"
                          >
                            <span className="flex items-center gap-1.5 font-medium text-foreground">
                              <Bot className="h-4 w-4 text-primary" />
                              已汇总本周（{weekLabel}）共 {promoCount} 次推广、{weekTotal} 人转化数据发起智能复盘
                            </span>
                            <Badge variant="outline" className="text-[11px]">
                              初始分析
                            </Badge>
                          </div>
                        );
                      }
                      // 后续多轮追问展示为用户气泡
                      return (
                        <div key={msg.id} className="flex items-start gap-2.5 justify-end">
                          <div className="rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm max-w-[85%] shadow-sm">
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                          <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-primary mt-0.5">
                            <UserIcon className="h-4 w-4" />
                          </div>
                        </div>
                      );
                    }

                    // Assistant 回复
                    const isLast = idx === messages.length - 1;
                    return (
                      <div key={msg.id} className="flex items-start gap-3">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary mt-0.5">
                          <Bot className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0 rounded-lg bg-card border p-4 shadow-sm text-sm leading-relaxed">
                          {!msg.content && aiStreaming ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              AI 正在深入复盘本周任务并生成下周推广建议...
                            </div>
                          ) : (
                            <>
                              <SimpleMarkdown
                                content={msg.content}
                                onGenerateTask={handleGenerateTask}
                              />
                              {isLast && aiStreaming && (
                                <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div ref={chatScrollRef} />

                {/* 追问输入框与快捷建议 */}
                {!aiStreaming && messages.length > 0 && (
                  <div className="pt-2 border-t space-y-2.5">
                    {/* 快捷追问胶囊 */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground flex items-center gap-1 shrink-0">
                        <Sparkles className="h-3 w-3 text-primary" />
                        快捷提问：
                      </span>
                      {[
                        '针对本周转化最低的任务，有什么具体调整建议？',
                        '如果想在下周提升晚上时段转化，该如何规划？',
                        '下周推荐任务中哪个优先级最高，建议先执行哪个？',
                      ].map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => handleSendMessage(q)}
                          className="rounded-full bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground px-2.5 py-1 text-xs transition-colors text-left"
                        >
                          {q}
                        </button>
                      ))}
                    </div>

                    {/* 输入行 */}
                    <div className="flex items-end gap-2">
                      <Textarea
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        placeholder="输入追问内容，如：羽毛球活动下周哪天推广合适？（Enter 发送，Shift+Enter 换行）"
                        className="min-h-[60px] max-h-32 text-sm resize-none"
                        disabled={aiStreaming}
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSendMessage()}
                        disabled={aiStreaming || !inputMessage.trim()}
                        className="h-10 px-4 shrink-0"
                      >
                        <Send className="h-4 w-4 mr-1" />
                        发送
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}