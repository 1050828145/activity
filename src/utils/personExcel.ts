import * as XLSX from 'xlsx';
import type { PersonFormData } from '@/types';

// 人员Excel模板列定义
const PERSON_COLUMNS = [
  { header: '姓名*', key: 'name', width: 15 },
  { header: '联系方式*', key: 'contact', width: 15 },
  { header: '性别', key: 'gender', width: 10 },
  { header: '年龄', key: 'age', width: 10 },
  { header: '身份证号', key: 'id_number', width: 20 },
  { header: '照片URL', key: 'photo_url', width: 30 },
  { header: '擅长领域', key: 'expertise', width: 20 },
  { header: '备注', key: 'notes', width: 30 },
];

// 下载人员Excel模板
export function downloadPersonTemplate() {
  // 创建工作簿
  const wb = XLSX.utils.book_new();
  
  // 创建示例数据
  const sampleData = [
    {
      '姓名*': '张三',
      '联系方式*': '13800138000',
      '性别': '男',
      '年龄': 25,
      '身份证号': '110101199001011234',
      '照片URL': '',
      '擅长领域': '主持人',
      '备注': '经验丰富',
    },
    {
      '姓名*': '李四',
      '联系方式*': '13900139000',
      '性别': '女',
      '年龄': 28,
      '身份证号': '110101199201011234',
      '照片URL': '',
      '擅长领域': '礼仪',
      '备注': '形象好',
    },
  ];

  // 创建工作表
  const ws = XLSX.utils.json_to_sheet(sampleData);

  // 设置列宽
  ws['!cols'] = PERSON_COLUMNS.map(col => ({ wch: col.width }));

  // 添加工作表到工作簿
  XLSX.utils.book_append_sheet(wb, ws, '人员列表');

  // 下载文件
  XLSX.writeFile(wb, '人员批量导入模板.xlsx');
}

// 解析人员Excel文件
export function parsePersonExcel(file: File): Promise<PersonFormData[]> {
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

        // 转换为PersonFormData格式
        const persons: PersonFormData[] = jsonData.map((row: any) => ({
          name: row['姓名*'] || row['姓名'] || '',
          contact: row['联系方式*'] || row['联系方式'] || '',
          gender: row['性别'] || '',
          age: row['年龄'] ? parseInt(row['年龄']) : undefined,
          id_number: row['身份证号'] || '',
          photo_url: row['照片URL'] || '',
          expertise: row['擅长领域'] || '',
          notes: row['备注'] || '',
        }));

        resolve(persons);
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
