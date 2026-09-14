import * as XLSX from 'xlsx';
import type { ActivityFormData } from '@/types';

// 活动Excel模板列定义
const ACTIVITY_COLUMNS = [
  { header: '活动名称*', key: 'name', width: 20 },
  { header: '活动类型', key: 'type', width: 10 },
  { header: '活动状态', key: 'status', width: 12 },
  { header: '开始日期*', key: 'start_date', width: 15 },
  { header: '结束日期', key: 'end_date', width: 15 },
  { header: '发薪日期', key: 'payment_date', width: 15 },
  { header: '活动地点*', key: 'location', width: 20 },
  { header: '活动概要', key: 'summary', width: 30 },
  { header: '活动内容', key: 'content', width: 30 },
  { header: '需求人数*', key: 'required_people', width: 12 },
  { header: '人员要求', key: 'requirements', width: 30 },
  { header: '利润', key: 'profit', width: 12 },
  { header: '兼职工资', key: 'part_time_salary', width: 12 },
  { header: '人头费', key: 'per_head_fee', width: 12 },
  { header: '押金', key: 'deposit', width: 12 },
  { header: '备注', key: 'notes', width: 30 },
];

// 下载活动Excel模板
export function downloadActivityTemplate() {
  // 创建工作簿
  const wb = XLSX.utils.book_new();
  
  // 创建示例数据
  const sampleData = [
    {
      '活动名称*': '年会活动',
      '活动类型': '短期',
      '活动状态': '待确认',
      '开始日期*': '2026-02-01',
      '结束日期': '2026-02-01',
      '发薪日期': '2026-02-10',
      '活动地点*': '会议中心',
      '活动概要': '公司年度总结表彰大会',
      '活动内容': '公司年会',
      '需求人数*': 50,
      '人员要求': '形象好气质佳',
      '利润': 5000,
      '兼职工资': 200,
      '人头费': 100,
      '押金': 50,
      '备注': '重要活动',
    },
    {
      '活动名称*': '团建活动',
      '活动类型': '长期',
      '活动状态': '已确认',
      '活动日期*': '2026-02-15',
      '活动地点*': '度假村',
      '活动概要': '团队凝聚力提升活动',
      '活动内容': '团队建设',
      '需求人数*': 30,
      '人员要求': '活泼开朗',
      '利润': 3000,
      '兼职工资': 150,
      '人头费': 80,
      '押金': 30,
      '备注': '',
    },
  ];

  // 创建工作表
  const ws = XLSX.utils.json_to_sheet(sampleData);

  // 设置列宽
  ws['!cols'] = ACTIVITY_COLUMNS.map(col => ({ wch: col.width }));

  // 添加工作表到工作簿
  XLSX.utils.book_append_sheet(wb, ws, '活动列表');

  // 下载文件
  XLSX.writeFile(wb, '活动批量导入模板.xlsx');
}

// 解析活动Excel文件
export function parseActivityExcel(file: File): Promise<ActivityFormData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // 读取第一个工作表
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // 转换为JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // 转换为ActivityFormData格式
        const activities: ActivityFormData[] = jsonData.map((row: any) => ({
          name: row['活动名称*'] || row['活动名称'] || '',
          type: row['活动类型'] || '短期',
          status: row['活动状态'] || '待确认',
          start_date: row['开始日期*'] || row['开始日期'] || (row['活动类型'] === '长期' ? undefined : new Date().toISOString().split('T')[0]),
          end_date: row['结束日期'] || undefined,
          payment_date: row['发薪日期'] || undefined,
          location: row['活动地点*'] || row['活动地点'] || '',
          summary: row['活动概要'] || '',
          content: row['活动内容'] || '',
          required_people: parseInt(row['需求人数*'] || row['需求人数'] || '0'),
          requirements: row['人员要求'] || '',
          profit: row['利润'] ? parseFloat(row['利润']) : undefined,
          part_time_salary: row['兼职工资'] ? parseFloat(row['兼职工资']) : undefined,
          per_head_fee: row['人头费'] ? parseFloat(row['人头费']) : undefined,
          deposit: row['押金'] ? parseFloat(row['押金']) : undefined,
          notes: row['备注'] || '',
        }));

        resolve(activities);
      } catch (error) {
        reject(new Error('Excel文件解析失败,请检查文件格式'));
      }
    };

    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };

    reader.readAsBinaryString(file);
  });
}
