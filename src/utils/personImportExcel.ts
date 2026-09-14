import * as XLSX from 'xlsx';
import type { PersonFormData } from '@/types';

// 人员导入模板列定义
export const PERSON_IMPORT_COLUMNS = [
  { header: '姓名*', key: 'name', width: 15 },
  { header: '联系方式*', key: 'contact', width: 15 },
  { header: '性别', key: 'gender', width: 10 },
  { header: '年龄', key: 'age', width: 10 },
  { header: '身份证号', key: 'id_number', width: 20 },
  { header: '擅长领域', key: 'expertise', width: 20 },
  { header: '工资', key: 'wage', width: 12 },
  { header: '押金', key: 'deposit', width: 12 },
  { header: '人头费', key: 'commission', width: 12 },
  { header: '参与状态', key: 'status', width: 12 },
  { header: '备注', key: 'notes', width: 30 },
];

// 人员导入数据类型
export interface PersonImportData extends PersonFormData {
  wage?: number;
  deposit?: number;
  commission?: number;
  status?: string;
  participantNotes?: string;
}

// 生成人员导入模板
export function generatePersonImportTemplate(filename: string = '活动人员导入模板.xlsx') {
  const wb = XLSX.utils.book_new();
  
  // 创建示例数据
  const exampleData = [
    {
      '姓名*': '张三',
      '联系方式*': '13800138001',
      '性别': '男',
      '年龄': 25,
      '身份证号': '110101199001011234',
      '擅长领域': '活动策划',
      '工资': 200,
      '押金': 100,
      '人头费': 50,
      '参与状态': '待确认',
      '备注': '有经验',
    },
    {
      '姓名*': '李四',
      '联系方式*': '13800138002',
      '性别': '女',
      '年龄': 28,
      '身份证号': '110101199201011234',
      '擅长领域': '现场执行',
      '工资': 180,
      '押金': 100,
      '人头费': 50,
      '参与状态': '已确认',
      '备注': '',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(exampleData);
  
  // 设置列宽
  ws['!cols'] = PERSON_IMPORT_COLUMNS.map(col => ({ wch: col.width }));

  XLSX.utils.book_append_sheet(wb, ws, '人员导入');
  XLSX.writeFile(wb, filename);
}

// 解析人员导入Excel
export async function parsePersonImportExcel(file: File): Promise<PersonImportData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // 转换为PersonImportData格式
        const persons: PersonImportData[] = jsonData.map((row: any) => {
          const person: PersonImportData = {
            name: row['姓名*'] || row['姓名'] || '',
            contact: row['联系方式*'] || row['联系方式'] || '',
            gender: row['性别'] || '',
            age: row['年龄'] ? parseInt(row['年龄']) : undefined,
            id_number: row['身份证号'] || '',
            expertise: row['擅长领域'] || '',
            notes: row['备注'] || '',
            // 参与记录相关字段
            wage: row['工资'] ? parseFloat(row['工资']) : undefined,
            deposit: row['押金'] ? parseFloat(row['押金']) : undefined,
            commission: row['人头费'] ? parseFloat(row['人头费']) : undefined,
            status: row['参与状态'] || '待确认',
            participantNotes: row['备注'] || '',
          };

          return person;
        });

        // 验证必填字段
        const invalidPersons = persons.filter(p => !p.name || !p.contact);
        if (invalidPersons.length > 0) {
          reject(new Error(`发现 ${invalidPersons.length} 条数据缺少必填字段(姓名或联系方式)`));
          return;
        }

        resolve(persons);
      } catch (error) {
        reject(new Error('解析Excel文件失败，请确保文件格式正确'));
      }
    };

    reader.onerror = () => {
      reject(new Error('读取文件失败'));
    };

    reader.readAsBinaryString(file);
  });
}
