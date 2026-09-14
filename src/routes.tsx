import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import Activities from './pages/Activities';
import ActivityDetail from './pages/ActivityDetail';
import Persons from './pages/Persons';
import PersonDetail from './pages/PersonDetail';
import Leaders from './pages/Leaders';
import Participations from './pages/Participations';
import PendingRegistrations from './pages/PendingRegistrations';
import DataBackup from './pages/System/DataBackup';
import Users from './pages/System/Users';
import TableColumnConfigs from './pages/System/TableColumnConfigs';
import ActivityTypes from './pages/ActivityTypes';
import ActivityParticipantsList from './pages/DataProducts/ActivityParticipantsList';
import DailyParticipantsReport from './pages/DailyParticipantsReport';
import LeaderRecruitmentAnalysis from './pages/LeaderRecruitmentAnalysis';
import EmailNotifications from './pages/EmailNotifications';
import UserCenter from './pages/UserCenter';
import ScheduledTasks from './pages/ScheduledTasks';
import PromotionDailyTasks from './pages/Promotion/DailyTasks';
import PromotionTaskSettings from './pages/Promotion/TaskSettings';
import PromotionRecords from './pages/Promotion/Records';
import PromotionWeeklyReport from './pages/Promotion/WeeklyReport';
import MobileHome from './pages/mobile/MobileHome';
import MobileActivities from './pages/mobile/MobileActivities';
import MobileActivityDetail from './pages/mobile/MobileActivityDetail';
import MobileActivityRegister from './pages/mobile/MobileActivityRegister';
import MobilePersons from './pages/mobile/MobilePersons';
import MobileParticipations from './pages/mobile/MobileParticipations';
import type { ReactNode } from 'react';

interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
}

const routes: RouteConfig[] = [
  {
    name: '主页',
    path: '/',
    element: <Home />
  },
  {
    name: '仪表盘',
    path: '/dashboard',
    element: <Dashboard />
  },
  {
    name: '新的报名',
    path: '/pending-registrations',
    element: <PendingRegistrations />
  },
  {
    name: '活动管理',
    path: '/activities',
    element: <Activities />
  },
  {
    name: '活动详情',
    path: '/activities/:id',
    element: <ActivityDetail />,
    visible: false
  },
  {
    name: '人员管理',
    path: '/persons',
    element: <Persons />
  },
  {
    name: '人员详情',
    path: '/persons/:id',
    element: <PersonDetail />,
    visible: false
  },
  {
    name: '领队管理',
    path: '/leaders',
    element: <Leaders />
  },
  {
    name: '参与记录',
    path: '/participations',
    element: <Participations />
  },
  {
    name: '每日任务',
    path: '/promotion/daily-tasks',
    element: <PromotionDailyTasks />
  },
  {
    name: '任务设置',
    path: '/promotion/task-settings',
    element: <PromotionTaskSettings />
  },
  {
    name: '推广记录',
    path: '/promotion/records',
    element: <PromotionRecords />
  },
  {
    name: '推广转化周报',
    path: '/promotion/weekly-report',
    element: <PromotionWeeklyReport />
  },
  {
    name: '活动类型管理',
    path: '/activity-types',
    element: <ActivityTypes />
  },
  {
    name: '新增参与人员统计',
    path: '/analytics/daily-participants',
    element: <DailyParticipantsReport />
  },
  {
    name: '领队招募情况分析',
    path: '/analytics/leader-recruitment',
    element: <LeaderRecruitmentAnalysis />
  },
  {
    name: '活动和参与人员清单',
    path: '/data-products/activity-participants-list',
    element: <ActivityParticipantsList />
  },
  {
    name: '邮箱通知',
    path: '/notifications/email',
    element: <EmailNotifications />
  },
  {
    name: '用户中心',
    path: '/user-center',
    element: <UserCenter />,
    visible: false
  },
  {
    name: '定时任务',
    path: '/scheduled-tasks',
    element: <ScheduledTasks />
  },
  {
    name: '用户管理',
    path: '/system/users',
    element: <Users />
  },
  {
    name: '列表配置',
    path: '/system/table-configs',
    element: <TableColumnConfigs />
  },
  {
    name: '数据备份',
    path: '/system/backup',
    element: <DataBackup />
  },
  {
    name: '移动端主页',
    path: '/mobile',
    element: <MobileHome />,
    visible: false
  },
  {
    name: '移动端活动',
    path: '/mobile/activities',
    element: <MobileActivities />,
    visible: false
  },
  {
    name: '移动端活动详情',
    path: '/mobile/activities/:id',
    element: <MobileActivityDetail />,
    visible: false
  },
  {
    name: '活动报名',
    path: '/mobile/activity/:id/register',
    element: <MobileActivityRegister />,
    visible: false
  },
  {
    name: '移动端人员',
    path: '/mobile/persons',
    element: <MobilePersons />,
    visible: false
  },
  {
    name: '移动端参与',
    path: '/mobile/participations',
    element: <MobileParticipations />,
    visible: false
  }
];

export default routes;
