import { useState, useEffect } from 'react';
import { getTableColumnConfigs } from '@/db/api';
import type { TableColumnConfig } from '@/types';

/**
 * 获取表格列配置的 Hook
 * @param pageName 页面名称
 * @returns 列配置数组（已排序、已过滤隐藏列）
 */
export function useTableColumns(pageName: string) {
  const [columns, setColumns] = useState<TableColumnConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadColumns();
  }, [pageName]);

  const loadColumns = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTableColumnConfigs(pageName);
      
      // 只返回可见的列，并按 order_index 排序
      const visibleColumns = data
        .filter((col) => col.visible)
        .sort((a, b) => a.order_index - b.order_index);
      
      setColumns(visibleColumns);
    } catch (err: any) {
      console.error('加载列配置失败:', err);
      setError(err.message || '加载列配置失败');
      setColumns([]);
    } finally {
      setLoading(false);
    }
  };

  return { columns, loading, error, reload: loadColumns };
}

/**
 * 根据列配置获取列键名数组
 * @param columns 列配置数组
 * @returns 列键名数组
 */
export function getColumnKeys(columns: TableColumnConfig[]): string[] {
  return columns.map((col) => col.column_key);
}

/**
 * 根据列配置获取列标签映射
 * @param columns 列配置数组
 * @returns 列键名到标签的映射
 */
export function getColumnLabels(columns: TableColumnConfig[]): Record<string, string> {
  return columns.reduce((acc, col) => {
    acc[col.column_key] = col.column_label;
    return acc;
  }, {} as Record<string, string>);
}

/**
 * 检查列是否可见
 * @param columns 列配置数组
 * @param columnKey 列键名
 * @returns 是否可见
 */
export function isColumnVisible(columns: TableColumnConfig[], columnKey: string): boolean {
  const column = columns.find((col) => col.column_key === columnKey);
  return column ? column.visible : true; // 默认可见
}
