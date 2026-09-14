/**
 * 页面缓存 Hook - 已禁用
 * 
 * 注意：此功能已被禁用，不再保存和恢复页面状态
 * 保留此 hook 是为了避免修改所有使用它的组件
 */

/**
 * 页面缓存 Hook - 已禁用
 */
export function usePageCache<T>(
  pageName: string,
  getState: () => T
): T | null {
  // 功能已禁用，直接返回 null
  return null;
}

/**
 * 清除页面缓存 - 已禁用
 */
export function clearPageCache(pageName: string) {
  // 功能已禁用
}

/**
 * 清除所有页面缓存 - 已禁用
 */
export function clearAllPageCache() {
  // 功能已禁用
}
