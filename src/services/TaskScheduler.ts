import { supabase } from '@/db/supabase';
import CronParser from 'cron-parser';
import { toast } from 'sonner';

interface ScheduledTask {
  id: string;
  name: string;
  task_type: string;
  cron_expression: string;
  task_config?: Record<string, any>;
  last_execution_time?: string;
  enabled: boolean;
}

class TaskScheduler {
  private instanceId: string;
  private checkInterval: number = 10000; // 每10秒检查一次（更频繁，方便测试）
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastCheckTime: Date | null = null;
  private executionCount: number = 0;

  constructor() {
    // 生成唯一的实例 ID
    this.instanceId = `scheduler-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`%c[TaskScheduler] 🚀 初始化调度器实例: ${this.instanceId}`, 'color: #00ff00; font-weight: bold;');
  }

  /**
   * 启动调度器
   */
  start() {
    if (this.isRunning) {
      console.log('%c[TaskScheduler] ⚠️ 调度器已在运行', 'color: #ffaa00; font-weight: bold;');
      return;
    }

    console.log('%c[TaskScheduler] ▶️ 启动调度器', 'color: #00ff00; font-weight: bold;');
    this.isRunning = true;

    // 显示启动通知
    toast.success('定时任务调度器已启动', {
      description: '系统将自动检查并执行定时任务',
      duration: 3000,
    });

    // 立即执行一次检查
    console.log('%c[TaskScheduler] 🔍 立即执行首次检查', 'color: #00aaff; font-weight: bold;');
    this.checkAndExecuteTasks();

    // 设置定时检查
    this.intervalId = setInterval(() => {
      this.checkAndExecuteTasks();
    }, this.checkInterval);

    console.log(`%c[TaskScheduler] ⏰ 定时器已设置，每 ${this.checkInterval / 1000} 秒检查一次`, 'color: #00aaff; font-weight: bold;');
  }

  /**
   * 停止调度器
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    console.log('%c[TaskScheduler] ⏹️ 停止调度器', 'color: #ff0000; font-weight: bold;');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * 获取调度器状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      instanceId: this.instanceId,
      lastCheckTime: this.lastCheckTime,
      executionCount: this.executionCount,
      checkInterval: this.checkInterval,
    };
  }

  /**
   * 检查并执行任务
   */
  private async checkAndExecuteTasks() {
    this.lastCheckTime = new Date();
    
    try {
      console.log(`%c[TaskScheduler] 🔍 开始检查任务 (第 ${this.executionCount + 1} 次)`, 'color: #00aaff; font-weight: bold;');
      console.log(`%c[TaskScheduler] ⏰ 当前时间: ${this.lastCheckTime.toLocaleString('zh-CN')}`, 'color: #aaaaaa;');

      // 检查调度器是否启用
      const { data: schedulerSetting, error: settingError } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'scheduler_enabled')
        .maybeSingle();

      if (settingError) {
        console.error('%c[TaskScheduler] ❌ 获取调度器状态失败:', 'color: #ff0000; font-weight: bold;', settingError);
        return;
      }

      const schedulerEnabled = (schedulerSetting as any)?.setting_value === 'true';
      if (!schedulerEnabled) {
        console.log('%c[TaskScheduler] ⏸️ 调度器已关闭，停止扫描', 'color: #ffaa00; font-weight: bold;');
        // 调度器关闭时停止定时器，不再扫描
        await this.stop();
        return;
      }

      // 使用简单的锁机制（localStorage）
      const lockKey = 'task_scheduler_lock';
      const lockValue = localStorage.getItem(lockKey);
      const now = Date.now();

      // 检查锁是否存在且未过期（30秒过期）
      if (lockValue) {
        const lockTime = parseInt(lockValue);
        if (now - lockTime < 30000) {
          console.log('%c[TaskScheduler] 🔒 其他实例正在执行，跳过本次检查', 'color: #ffaa00;');
          return;
        }
      }

      // 获取锁
      localStorage.setItem(lockKey, now.toString());
      console.log('%c[TaskScheduler] 🔓 成功获取锁', 'color: #00ff00;');

      // 获取所有启用的任务
      const { data: tasks, error } = await supabase
        .from('scheduled_tasks')
        .select('*')
        .eq('enabled', true);

      if (error) {
        console.error('%c[TaskScheduler] ❌ 获取任务失败:', 'color: #ff0000; font-weight: bold;', error);
        localStorage.removeItem(lockKey);
        return;
      }

      if (!tasks || tasks.length === 0) {
        console.log('%c[TaskScheduler] 📭 没有启用的任务', 'color: #aaaaaa;');
        localStorage.removeItem(lockKey);
        return;
      }

      console.log(`%c[TaskScheduler] 📋 找到 ${tasks.length} 个启用的任务`, 'color: #00ff00; font-weight: bold;');

      const currentTime = new Date();
      let executedCount = 0;

      // 检查每个任务是否需要执行
      for (const task of tasks as ScheduledTask[]) {
        try {
          console.log(`%c[TaskScheduler] 📝 检查任务: ${task.name}`, 'color: #00aaff;');
          console.log(`  - Cron 表达式: ${task.cron_expression}`);
          console.log(`  - 上次执行: ${task.last_execution_time || '从未执行'}`);
          
          if (this.shouldExecuteTask(task, currentTime)) {
            console.log(`%c[TaskScheduler] ✅ 任务需要执行: ${task.name}`, 'color: #00ff00; font-weight: bold;');
            await this.executeTask(task);
            executedCount++;
            this.executionCount++;
          } else {
            console.log(`%c[TaskScheduler] ⏭️ 任务暂不需要执行: ${task.name}`, 'color: #aaaaaa;');
          }
        } catch (error) {
          console.error(`%c[TaskScheduler] ❌ 任务执行失败: ${task.name}`, 'color: #ff0000; font-weight: bold;', error);
        }
      }

      if (executedCount > 0) {
        console.log(`%c[TaskScheduler] 🎉 本次检查执行了 ${executedCount} 个任务`, 'color: #00ff00; font-weight: bold;');
        toast.success(`执行了 ${executedCount} 个定时任务`);
      } else {
        console.log('%c[TaskScheduler] ✓ 本次检查完成，没有需要执行的任务', 'color: #aaaaaa;');
      }

      // 释放锁
      localStorage.removeItem(lockKey);
      console.log('%c[TaskScheduler] 🔓 释放锁', 'color: #00ff00;');
    } catch (error) {
      console.error('%c[TaskScheduler] ❌ 检查任务时发生错误:', 'color: #ff0000; font-weight: bold;', error);
      // 确保释放锁
      localStorage.removeItem('task_scheduler_lock');
    }
  }

  /**
   * 判断任务是否应该执行
   */
  private shouldExecuteTask(task: ScheduledTask, now: Date): boolean {
    try {
      console.log(`    🔍 判断任务是否需要执行...`);
      
      // 解析 Cron 表达式
      const interval = CronParser.parse(task.cron_expression, {
        currentDate: task.last_execution_time ? new Date(task.last_execution_time) : new Date(now.getTime() - 24 * 60 * 60 * 1000), // 如果没有上次执行时间，从昨天开始
      });
      
      const nextExecution = interval.next().toDate();
      console.log(`    📅 下次执行时间: ${nextExecution.toLocaleString('zh-CN')}`);
      console.log(`    ⏰ 当前时间: ${now.toLocaleString('zh-CN')}`);
      
      const shouldExecute = nextExecution <= now;
      console.log(`    ${shouldExecute ? '✅' : '❌'} 判断结果: ${shouldExecute ? '需要执行' : '不需要执行'}`);
      
      return shouldExecute;
    } catch (error) {
      console.error(`    ❌ 解析 Cron 表达式失败: ${task.cron_expression}`, error);
      return false;
    }
  }

  /**
   * 执行任务
   */
  private async executeTask(task: ScheduledTask) {
    try {
      console.log(`%c[TaskScheduler] 🚀 开始执行任务: ${task.name}`, 'color: #ff00ff; font-weight: bold;');
      
      const { data, error } = await supabase.functions.invoke('execute-task', {
        body: {
          task_id: task.id,
          task_type: task.task_type,
          task_config: task.task_config,
        },
      });

      if (error) {
        const errorMsg = await error?.context?.text();
        console.error(`%c[TaskScheduler] ❌ 任务执行失败: ${task.name}`, 'color: #ff0000; font-weight: bold;', errorMsg || error.message);
        throw new Error(errorMsg || error.message);
      }

      console.log(`%c[TaskScheduler] ✅ 任务执行成功: ${task.name}`, 'color: #00ff00; font-weight: bold;', data);
      
      // 更新本地缓存的最后执行时间
      task.last_execution_time = new Date().toISOString();
    } catch (error: any) {
      console.error(`%c[TaskScheduler] ❌ 调用 Edge Function 失败: ${task.name}`, 'color: #ff0000; font-weight: bold;', error);
      throw error;
    }
  }
}

// 创建单例实例
let schedulerInstance: TaskScheduler | null = null;

export function getTaskScheduler(): TaskScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new TaskScheduler();
  }
  return schedulerInstance;
}

export function startTaskScheduler() {
  const scheduler = getTaskScheduler();
  scheduler.start();
  
  // 将调度器实例暴露到全局，方便调试
  (window as any).__taskScheduler = scheduler;
  console.log('%c[TaskScheduler] 💡 调试提示: 可以在控制台使用 window.__taskScheduler.getStatus() 查看调度器状态', 'color: #00aaff; font-weight: bold;');
}

export function stopTaskScheduler() {
  if (schedulerInstance) {
    schedulerInstance.stop();
  }
}

export function getSchedulerStatus() {
  if (schedulerInstance) {
    return schedulerInstance.getStatus();
  }
  return null;
}
