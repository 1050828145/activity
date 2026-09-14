// 活动类型分类
export interface ActivityType {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

// 活动类型
export interface Activity {
  id: string;
  name: string;
  type: string;
  status: string;
  activity_type_id?: string;
  activity_type_name?: string;
  start_date: string | null;
  end_date?: string | null;
  payment_date?: string | null;
  location: string;
  summary?: string;
  content?: string;
  registration_method?: string;
  required_people: number;
  requirements?: string;
  profit?: number;
  part_time_salary?: number;
  per_head_fee?: number;
  deposit?: number;
  notes?: string;
  participant_count?: number;
  total_participants?: number; // 总参与人数（缓存字段）
  created_at: string;
  updated_at: string;
}

// 人员类型
export interface Person {
  id: string;
  name: string;
  contact: string;
  gender?: string;
  age?: number;
  height?: number;
  weight?: number;
  id_number?: string;
  photo_url?: string;
  expertise?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// 领队类型
export interface Leader {
  id: string;
  name: string;
  gender?: string;
  age?: number;
  contact: string;
  wechat?: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// 活动参与关系类型
export interface ActivityParticipant {
  id: string;
  activity_id: string;
  person_id: string;
  status: string;
  salary?: number;
  deposit?: number;
  per_head_fee?: number;
  introducer_id?: string;
  is_paid: boolean;
  registration_source?: string; // 报名来源: manual(手动添加), qrcode(二维码报名)
  is_viewed?: boolean; // 是否已查看
  viewed_at?: string; // 查看时间
  added_at?: string; // 添加时间（精确到分钟）
  created_at: string;
  updated_at: string;
}

// 待办报名信息（包含活动和人员信息）
export interface PendingRegistration extends ActivityParticipant {
  activity?: Activity;
  person?: Person;
}

// 活动领队关系类型
export interface ActivityLeader {
  id: string;
  activity_id: string;
  leader_id: string;
  participant_count: number; // 该领队带的参与人数
  created_at: string;
  updated_at: string;
}

// 活动领队人数变更记录
export interface ActivityLeaderChange {
  id: string;
  activity_leader_id: string;
  activity_id: string;
  leader_id: string;
  change_amount: number; // 变更数量（正数=增加，负数=减少）
  previous_count: number; // 变更前的人数
  new_count: number; // 变更后的人数
  changed_by: string;
  changed_at: string;
  note?: string;
  created_at: string;
  // 关联数据
  leader?: Leader;
}

// 领队参与人数类型（用于线上活动）
export interface LeaderParticipant {
  id: string;
  activity_id: string;
  leader_id: string;
  participant_count: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  // 关联数据
  leader?: Leader;
}

// 领队参与人数表单数据
export type LeaderParticipantFormData = Omit<LeaderParticipant, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'leader'>;

// 活动详情(包含参与人员)
export interface ActivityWithParticipants extends Activity {
  participants?: Person[];
}

// 人员详情(包含参与活动)
export interface PersonWithActivities extends Person {
  activities?: Activity[];
}

// 统计数据类型
export interface Statistics {
  total_activities: number;
  total_persons: number;
  total_leaders: number;
  ongoing_activities: number;
  upcoming_activities: number;
  unpaid_participants: number;
  ending_soon_activities: number;
  today_new_activities: number;
  today_new_persons: number;
  today_new_leaders: number;
  today_new_participants: number;
}

// 活动表单数据
export type ActivityFormData = Omit<Activity, 'id' | 'created_at' | 'updated_at'>;

// 活动类型表单数据
export type ActivityTypeFormData = Omit<ActivityType, 'id' | 'created_at' | 'updated_at'>;

// 人员表单数据
export type PersonFormData = Omit<Person, 'id' | 'created_at' | 'updated_at'>;

// 领队表单数据
export type LeaderFormData = Omit<Leader, 'id' | 'created_at' | 'updated_at'>;

// 参与人员表单数据
export type ParticipantFormData = Omit<ActivityParticipant, 'id' | 'activity_id' | 'created_at'>;

// 领队招募统计数据
export interface LeaderRecruitmentStats {
  leader_id: string;
  leader_name: string;
  total_recruited: number;
  total_activities: number;
  attendance_rate: number | null;
  activity_type_distribution: { [key: string]: number };
}

// 领队招募详情
export interface LeaderRecruitmentDetail {
  leader: Leader;
  recruited_persons: Array<{
    person: Person;
    activities: Array<{
      activity: Activity;
      status: string;
      activity_type?: string;
    }>;
    total_activities: number;
    attendance_count: number;
    attendance_rate: number;
  }>;
}

// 用户资料
export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  avatar_url?: string;
  role: string;
  created_at: string;
  updated_at: string;
}

// 邮件通知任务
export interface EmailNotification {
  id: string;
  user_id: string;
  name: string;
  enabled: boolean;
  schedule_type: 'daily' | 'weekdays' | 'custom';
  schedule_time: string;
  schedule_days?: number[];
  content_types: string[];
  created_at: string;
  updated_at: string;
}

// 邮件配置
export interface EmailConfig {
  id: string;
  resend_api_key: string;
  from_email: string;
  from_name: string;
  created_at: string;
  updated_at: string;
}

// 定时任务类型
export type TaskType = 'send_email' | 'data_cleanup' | 'report_generation' | 'custom';

// 定时任务
export interface ScheduledTask {
  id: string;
  name: string;
  description?: string;
  task_type: TaskType;
  cron_expression: string;
  enabled: boolean;
  task_config?: Record<string, any>;
  last_execution_time?: string;
  next_execution_time?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// 任务执行日志
export interface TaskExecutionLog {
  id: string;
  task_id: string;
  status: 'success' | 'failed' | 'running';
  started_at: string;
  completed_at?: string;
  error_message?: string;
  execution_details?: Record<string, any>;
}

// 表格列配置
export interface TableColumnConfig {
  id: string;
  page_name: string;
  column_key: string;
  column_label: string;
  visible: boolean;
  order_index: number;
  width?: number | null;
  created_at: string;
  updated_at: string;
}

// 推广任务设置
export type PromotionCycleType = '短期任务' | '周期任务' | '长期任务';

export interface PromotionTask {
  id: string;
  name: string;
  is_common: boolean; // 通用：是=不指定活动列表
  activity_list?: string | null; // 活动列表：推广哪些活动，存储逗号分隔的活动 ID
  cycle_type: PromotionCycleType; // 周期类型
  start_date?: string | null; // 短期任务开始日期 / 周期任务起始日期
  end_date?: string | null; // 短期任务结束日期
  cycle_interval?: number | null; // 周期任务执行间隔天数
  promotion_time: string; // 推广时间 HH:mm:ss
  status: '启用' | '停用'; // 停用：不展示在每日任务中
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type PromotionTaskFormData = Omit<PromotionTask, 'id' | 'created_at' | 'updated_at'>;

// 推广任务每日执行记录
export interface PromotionTaskRecord {
  id: string;
  task_id: string;
  record_date: string; // YYYY-MM-DD
  is_completed: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

// 实际推广详情（与执行记录一对一）
export interface PromotionTaskDetail {
  id: string;
  record_id: string;
  actual_time?: string | null; // 实际推广时间
  activity_ids?: string | null; // 推广活动列表（逗号分隔的活动 ID）
  channel?: string | null; // 推广渠道
  conversions: number; // 转化人数
  created_at: string;
  updated_at: string;
}

export type PromotionTaskDetailFormData = Pick<
  PromotionTaskDetail,
  'actual_time' | 'activity_ids' | 'channel' | 'conversions'
>;

// 推广状态（前端依据时间动态计算，不保存后端）
export type PromotionStatus = '已完成' | '未完成' | '已错过';
