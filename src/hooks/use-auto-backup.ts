import { useEffect } from 'react';
import { getFullBackupData, getSessionUser } from '@/db/api';
import { exportFullBackup } from '@/utils/exportExcel';
import { toast } from 'sonner';

export function useAutoBackup() {
  useEffect(() => {
    const performBackup = async () => {
      // 检查本会话是否已执行备份
      const hasBackedUp = sessionStorage.getItem('auto_backup_performed');
      if (hasBackedUp) return;

      try {
        const user = await getSessionUser();
        if (!user) return;

        // 获取用户名，优先使用 full_name，其次 email，最后默认值
        const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || '未知用户';
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        
        const dateTimeStr = `${year}${month}${day}_${hours}${minutes}`;
        const filename = `活动人员管理+${userName}.excel+${dateTimeStr}.xlsx`;

        // 加载所有数据
        const data = await getFullBackupData();
        
        // 执行导出
        exportFullBackup(
          data.activities,
          data.persons,
          data.leaders,
          data.participants,
          filename
        );

        // 标记本会话已备份
        sessionStorage.setItem('auto_backup_performed', 'true');
        toast.success('登录自动备份已完成', {
          description: `文件已导出：${filename}`
        });
      } catch (error) {
        console.error('自动备份失败:', error);
      }
    };

    // 稍微延迟一下执行，避免在刚进入页面加载时竞争资源
    const timer = setTimeout(performBackup, 2000);
    return () => clearTimeout(timer);
  }, []);
}
