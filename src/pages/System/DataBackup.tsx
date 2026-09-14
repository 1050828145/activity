import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Database, Download, Play, RefreshCcw, ShieldCheck } from 'lucide-react';
import { getBackupLogs, toggleAutoBackup } from '@/db/api';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export default function DataBackup() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(profile?.auto_backup ?? true);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await getBackupLogs();
      setLogs(data);
    } catch (error) {
      console.error('加载备份日志失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleToggleAutoBackup = async (checked: boolean) => {
    try {
      await toggleAutoBackup(checked);
      setAutoBackupEnabled(checked);
      toast.success(checked ? '自动备份已开启' : '自动备份已关闭');
    } catch (error) {
      toast.error('操作失败');
    }
  };

  const performBackup = async () => {
    setIsBackingUp(true);
    try {
      // 调用新的备份 API
      const { backupDatabase } = await import('@/db/api');
      const result = await backupDatabase();
      
      toast.success(`备份成功！已备份 ${result.tableCount} 个表结构，${result.dataTableCount} 个表数据`);
      loadLogs();
      
      // 自动下载
      const blob = new Blob([result.sql], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('备份失败:', error);
      toast.error(error.message || '备份失败');
    } finally {
      setIsBackingUp(false);
    }
  };

  const downloadBackup = (log: any) => {
    const blob = new Blob([log.file_content], { type: 'text/sql' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = log.filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">数据备份</h1>
        <Button onClick={performBackup} disabled={isBackingUp}>
          {isBackingUp ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          立即执行备份
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              自动备份设置
            </CardTitle>
            <CardDescription>
              开启后，每次登录系统将自动为您备份当前项目的所有数据。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">登录自动备份</p>
              <p className="text-xs text-muted-foreground">默认开启，备份文件名为：秒哒-活动人员管理-用户名.sql</p>
            </div>
            <Switch 
              checked={autoBackupEnabled} 
              onCheckedChange={handleToggleAutoBackup} 
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              系统状态
            </CardTitle>
            <CardDescription>
              当前系统数据安全状态。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">最后备份时间:</span>
                <span className="font-medium">{logs[0] ? new Date(logs[0].created_at).toLocaleString() : '从无'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">总备份份数:</span>
                <span className="font-medium">{logs.length} 份</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>备份历史记录</CardTitle>
          <CardDescription>
            查看并下载最近的数据库备份文件。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>文件名</TableHead>
                <TableHead>备份时间</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">加载中...</TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">暂无备份记录</TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.filename}</TableCell>
                    <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className="bg-green-500 hover:bg-green-600 text-white border-none">
                        成功
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => downloadBackup(log)}>
                        <Download className="h-4 w-4 mr-2" />
                        下载
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
