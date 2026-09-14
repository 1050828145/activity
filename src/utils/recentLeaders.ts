// 管理最近使用的领队

const RECENT_LEADERS_KEY = 'recent_leaders';
const MAX_RECENT_LEADERS = 5; // 最多保存5个最近使用的领队

/**
 * 获取最近使用的领队ID列表
 */
export function getRecentLeaderIds(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_LEADERS_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('获取最近使用的领队失败:', error);
    return [];
  }
}

/**
 * 添加领队到最近使用列表
 * @param leaderId 领队ID
 */
export function addRecentLeader(leaderId: string): void {
  try {
    let recentIds = getRecentLeaderIds();
    
    // 移除已存在的相同ID（如果有）
    recentIds = recentIds.filter(id => id !== leaderId);
    
    // 将新ID添加到列表开头
    recentIds.unshift(leaderId);
    
    // 限制列表长度
    if (recentIds.length > MAX_RECENT_LEADERS) {
      recentIds = recentIds.slice(0, MAX_RECENT_LEADERS);
    }
    
    // 保存到localStorage
    localStorage.setItem(RECENT_LEADERS_KEY, JSON.stringify(recentIds));
  } catch (error) {
    console.error('保存最近使用的领队失败:', error);
  }
}

/**
 * 清除最近使用的领队列表
 */
export function clearRecentLeaders(): void {
  try {
    localStorage.removeItem(RECENT_LEADERS_KEY);
  } catch (error) {
    console.error('清除最近使用的领队失败:', error);
  }
}
