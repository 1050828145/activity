import * as XLSX from 'xlsx';
import type { Activity, Person, Leader } from '@/types';

// 通用函数：为数据添加序号并应用样式
function createStyledWorksheet(data: any[], sheetName: string) {
  // 添加序号
  const dataWithIndex = data.map((item, index) => ({
    '序号': index + 1,
    ...item
  }));

  const ws = XLSX.utils.json_to_sheet(dataWithIndex);
  
  // 获取数据范围
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  
  // 设置表头样式
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!ws[cellAddress]) continue;
    
    ws[cellAddress].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '4472C4' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
      }
    };
  }
  
  // 设置数据行样式和边框
  for (let row = range.s.r + 1; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      if (!ws[cellAddress]) continue;
      
      ws[cellAddress].s = {
        alignment: { horizontal: col === 0 ? 'center' : 'left', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: 'D3D3D3' } },
          bottom: { style: 'thin', color: { rgb: 'D3D3D3' } },
          left: { style: 'thin', color: { rgb: 'D3D3D3' } },
          right: { style: 'thin', color: { rgb: 'D3D3D3' } }
        }
      };
      
      // 斑马纹效果
      if (row % 2 === 0) {
        ws[cellAddress].s.fill = { fgColor: { rgb: 'F2F2F2' } };
      }
    }
  }
  
  return ws;
}

// 导出活动数据
export function exportActivities(activities: Activity[], filename: string = '活动数据.xlsx') {
  const data = activities.map(activity => ({
    '活动名称': activity.name,
    '活动状态': activity.status,
    '开始日期': activity.start_date,
    '结束日期': activity.end_date || '',
    '发薪日期': activity.payment_date || '',
    '活动地点': activity.location,
    '活动概要': activity.summary || '',
    '活动内容': activity.content || '',
    '需求人数': activity.required_people,
    '人员要求': activity.requirements || '',
    '利润': activity.profit || '',
    '兼职工资': activity.part_time_salary || '',
    '人头费': activity.per_head_fee || '',
    '押金': activity.deposit || '',
    '备注': activity.notes || '',
    '创建时间': activity.created_at,
  }));

  const wb = XLSX.utils.book_new();
  const ws = createStyledWorksheet(data, '活动列表');
  
  // 设置列宽
  ws['!cols'] = [
    { wch: 8 },  // 序号
    { wch: 20 }, // 活动名称
    { wch: 12 }, // 活动状态
    { wch: 15 }, // 开始日期
    { wch: 15 }, // 结束日期
    { wch: 15 }, // 发薪日期
    { wch: 20 }, // 活动地点
    { wch: 30 }, // 活动概要
    { wch: 30 }, // 活动内容
    { wch: 12 }, // 需求人数
    { wch: 30 }, // 人员要求
    { wch: 12 }, // 利润
    { wch: 12 }, // 兼职工资
    { wch: 12 }, // 人头费
    { wch: 12 }, // 押金
    { wch: 30 }, // 备注
    { wch: 20 }, // 创建时间
  ];

  XLSX.utils.book_append_sheet(wb, ws, '活动列表');
  XLSX.writeFile(wb, filename);
}

// 导出人员数据
export function exportPersons(persons: Person[], filename: string = '人员数据.xlsx') {
  const data = persons.map(person => ({
    '姓名': person.name,
    '联系方式': person.contact,
    '性别': person.gender || '',
    '年龄': person.age || '',
    '身份证号': person.id_number || '',
    '照片URL': person.photo_url || '',
    '擅长领域': person.expertise || '',
    '备注': person.notes || '',
    '创建时间': person.created_at,
  }));

  const wb = XLSX.utils.book_new();
  const ws = createStyledWorksheet(data, '人员列表');
  
  // 设置列宽
  ws['!cols'] = [
    { wch: 8 },  // 序号
    { wch: 15 }, // 姓名
    { wch: 15 }, // 联系方式
    { wch: 10 }, // 性别
    { wch: 10 }, // 年龄
    { wch: 20 }, // 身份证号
    { wch: 30 }, // 照片URL
    { wch: 20 }, // 擅长领域
    { wch: 30 }, // 备注
    { wch: 20 }, // 创建时间
  ];

  XLSX.utils.book_append_sheet(wb, ws, '人员列表');
  XLSX.writeFile(wb, filename);
}

// 导出领队数据
export function exportLeaders(leaders: Leader[], filename: string = '领队数据.xlsx') {
  const data = leaders.map(leader => ({
    '姓名': leader.name,
    '性别': leader.gender || '',
    '年龄': leader.age || '',
    '联系方式': leader.contact,
    '微信': leader.wechat || '',
    '状态': leader.status,
    '备注': leader.notes || '',
    '创建时间': leader.created_at,
  }));

  const wb = XLSX.utils.book_new();
  const ws = createStyledWorksheet(data, '领队列表');
  
  // 设置列宽
  ws['!cols'] = [
    { wch: 8 },  // 序号
    { wch: 15 }, // 姓名
    { wch: 10 }, // 性别
    { wch: 10 }, // 年龄
    { wch: 15 }, // 联系方式
    { wch: 15 }, // 微信
    { wch: 10 }, // 状态
    { wch: 30 }, // 备注
    { wch: 20 }, // 创建时间
  ];

  XLSX.utils.book_append_sheet(wb, ws, '领队列表');
  XLSX.writeFile(wb, filename);
}

// 导出活动参与记录
export function exportParticipants(participants: any[], filename: string = '参与记录.xlsx') {
  const data = participants.map(p => ({
    '活动名称': p.activity_name || '',
    '人员姓名': p.person_name || '',
    '联系方式': p.contact || '',
    '参与状态': p.status || '',
    '工资': p.salary || '',
    '押金': p.deposit || 0,
    '人头费': p.per_head_fee || '',
    '介绍人': p.introducer_name || '',
    '创建时间': p.created_at || '',
  }));

  const wb = XLSX.utils.book_new();
  const ws = createStyledWorksheet(data, '参与记录');
  
  // 设置列宽
  ws['!cols'] = [
    { wch: 8 },  // 序号
    { wch: 20 }, // 活动名称
    { wch: 15 }, // 人员姓名
    { wch: 15 }, // 联系方式
    { wch: 12 }, // 参与状态
    { wch: 12 }, // 工资
    { wch: 12 }, // 押金
    { wch: 12 }, // 人头费
    { wch: 15 }, // 介绍人
    { wch: 20 }, // 创建时间
  ];

  XLSX.utils.book_append_sheet(wb, ws, '参与记录');
  XLSX.writeFile(wb, filename);
}

// 导出全量备份数据
export function exportFullBackup(
  activities: Activity[],
  persons: Person[],
  leaders: Leader[],
  participants: any[],
  filename: string
) {
  const wb = XLSX.utils.book_new();

  // 活动管理 Sheet
  const activitiesData = activities.map(activity => ({
    '活动名称': activity.name,
    '活动状态': activity.status,
    '开始日期': activity.start_date,
    '结束日期': activity.end_date || '',
    '发薪日期': activity.payment_date || '',
    '活动地点': activity.location,
    '活动概要': activity.summary || '',
    '活动内容': activity.content || '',
    '需求人数': activity.required_people,
    '人员要求': activity.requirements || '',
    '利润': activity.profit || '',
    '兼职工资': activity.part_time_salary || '',
    '人头费': activity.per_head_fee || '',
    '押金': activity.deposit || '',
    '备注': activity.notes || '',
    '创建时间': activity.created_at,
  }));
  const wsActivities = createStyledWorksheet(activitiesData, '活动管理');
  wsActivities['!cols'] = [
    { wch: 8 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 30 }, { wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 20 }
  ];
  XLSX.utils.book_append_sheet(wb, wsActivities, '活动管理');

  // 人员管理 Sheet
  const personsData = persons.map(person => ({
    '姓名': person.name,
    '联系方式': person.contact,
    '性别': person.gender || '',
    '年龄': person.age || '',
    '身份证号': person.id_number || '',
    '照片URL': person.photo_url || '',
    '擅长领域': person.expertise || '',
    '备注': person.notes || '',
    '创建时间': person.created_at,
  }));
  const wsPersons = createStyledWorksheet(personsData, '人员管理');
  wsPersons['!cols'] = [
    { wch: 8 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 30 }, { wch: 20 }
  ];
  XLSX.utils.book_append_sheet(wb, wsPersons, '人员管理');

  // 领队管理 Sheet
  const leadersData = leaders.map(leader => ({
    '姓名': leader.name,
    '性别': leader.gender || '',
    '年龄': leader.age || '',
    '联系方式': leader.contact,
    '微信': leader.wechat || '',
    '状态': leader.status,
    '备注': leader.notes || '',
    '创建时间': leader.created_at,
  }));
  const wsLeaders = createStyledWorksheet(leadersData, '领队管理');
  wsLeaders['!cols'] = [
    { wch: 8 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 30 }, { wch: 20 }
  ];
  XLSX.utils.book_append_sheet(wb, wsLeaders, '领队管理');

  // 参与人员 Sheet
  const participantsData = participants.map(p => ({
    '活动名称': p.activities?.name || '',
    '人员姓名': p.persons?.name || '',
    '联系方式': p.persons?.contact || '',
    '参与状态': p.status || '',
    '工资': p.salary || '',
    '押金': p.deposit || 0,
    '人头费': p.per_head_fee || '',
    '已发薪': p.is_paid ? '是' : '否',
    '报名来源': p.registration_source || '',
    '创建时间': p.created_at || '',
  }));
  const wsParticipants = createStyledWorksheet(participantsData, '参与人员');
  wsParticipants['!cols'] = [
    { wch: 8 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 20 }
  ];
  XLSX.utils.book_append_sheet(wb, wsParticipants, '参与人员');

  XLSX.writeFile(wb, filename);
}

