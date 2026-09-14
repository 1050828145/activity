import * as XLSX from 'xlsx';
import type { LeaderFormData } from '@/types';

// 领队Excel模板列定义
const LEADER_COLUMNS = [
  { header: '姓名*', key: 'name', width: 15 },
  { header: '性别', key: 'gender', width: 10 },
  { header: '年龄', key: 'age', width: 10 },
  { header: '联系方式*', key: 'contact', width: 15 },
  { header: '微信', key: 'wechat', width: 15 },
  { header: '状态', key: 'status', width: 10 },
  { header: '备注', key: 'notes', width: 30 },
];

// 下载领队Excel模板
export function downloadLeaderTemplate() {
  // 创建工作簿
  const wb = XLSX.utils.book_new();
  
  // 创建示例数据
  const sampleData = [
    {
      '姓名*': '王领队',
      '性别': '男',
      '年龄': 35,
      '联系方式*': '13700137000',
      '微信': 'wanglindui',
      '状态': '在职',
      '备注': '资深领队',
    },
    {
      '姓名*': '李领队',
      '性别': '女',
      '年龄': 30,
      '联系方式*': '13800138000',
      '微信': 'lilindui',
      '状态': '在职',
      '备注': '经验丰富',
    },
  ];

  // 创建工作表
  const ws = XLSX.utils.json_to_sheet(sampleData);

  // 设置列宽
  ws['!cols'] = LEADER_COLUMNS.map(col => ({ wch: col.width }));

  // 添加工作表到工作簿
  XLSX.utils.book_append_sheet(wb, ws, '领队列表');

  // 下载文件
  XLSX.writeFile(wb, '领队批量导入模板.xlsx');
}

// 解析领队Excel文件
export function parseLeaderExcel(file: File): Promise<LeaderFormData[]> {
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

        // 转换为LeaderFormData格式
        const leaders: LeaderFormData[] = jsonData.map((row: any) => ({
          name: row['姓名*'] || row['姓名'] || '',
          gender: row['性别'] || '',
          age: row['年龄'] ? parseInt(row['年龄']) : undefined,
          contact: row['联系方式*'] || row['联系方式'] || '',
          wechat: row['微信'] || '',
          status: row['状态'] || '在职',
          notes: row['备注'] || '',
        }));

        resolve(leaders);
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
