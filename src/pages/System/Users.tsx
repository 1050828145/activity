import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Pencil, Key, Trash2, Shield, User as UserIcon, Loader2, RefreshCw } from 'lucide-react';
import { getAllProfiles, adminCreateUser, adminUpdateUser, adminResetPassword, adminDeleteUser } from '@/db/api';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Users() {
  const { profile: currentProfile } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // 对话框状态
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // 表单状态
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user' as 'user' | 'admin'
  });

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await getAllProfiles();
      setUsers(data);
    } catch (error: any) {
      toast.error('加载用户失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreate = async () => {
    if (!formData.username || !formData.password) {
      toast.error('请填写必填信息');
      return;
    }
    
    setProcessing(true);
    try {
      await adminCreateUser({
        username: formData.username,
        password: formData.password,
        email: formData.email || undefined
      });
      toast.success('用户创建成功');
      setShowCreateDialog(false);
      resetForm();
      loadUsers();
    } catch (error: any) {
      toast.error('创建失败: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedUser) return;
    
    setProcessing(true);
    try {
      await adminUpdateUser(selectedUser.id, {
        username: formData.username,
        role: formData.role
      });
      toast.success('用户信息更新成功');
      setShowEditDialog(false);
      loadUsers();
    } catch (error: any) {
      toast.error('更新失败: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !formData.password) return;
    
    setProcessing(true);
    try {
      await adminResetPassword(selectedUser.id, formData.password);
      toast.success('密码已重置');
      setShowPasswordDialog(false);
      resetForm();
    } catch (error: any) {
      toast.error('密码重置失败: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    if (selectedUser.id === currentProfile?.id) {
      toast.error('不能删除当前登录的账号');
      return;
    }

    setProcessing(true);
    try {
      await adminDeleteUser(selectedUser.id);
      toast.success('用户已删除');
      setShowDeleteDialog(false);
      loadUsers();
    } catch (error: any) {
      toast.error('删除失败: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      role: 'user'
    });
    setSelectedUser(null);
  };

  const openEditDialog = (user: any) => {
    setSelectedUser(user);
    setFormData({
      ...formData,
      username: user.username,
      role: user.role
    });
    setShowEditDialog(true);
  };

  const openPasswordDialog = (user: any) => {
    setSelectedUser(user);
    setFormData({ ...formData, password: '' });
    setShowPasswordDialog(true);
  };

  const openDeleteDialog = (user: any) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">用户管理</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={loadUsers} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} />
          </Button>
          <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
            <UserPlus className="mr-2 h-4 w-4" />
            新增用户
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>用户列表</CardTitle>
          <CardDescription>管理所有系统用户及其权限。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-auto max-h-[calc(100vh-280px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户名</TableHead>
                  <TableHead>身份</TableHead>
                  <TableHead>最近登录</TableHead>
                  <TableHead>最近登录IP</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <span>加载中...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">暂无用户</TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{user.username}</span>
                          <span className="text-xs text-muted-foreground">{user.email || '无邮箱'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.role === 'admin' ? (
                          <Badge variant="default" className="bg-primary flex w-fit items-center gap-1">
                            <Shield className="h-3 w-3" />
                            管理员
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="flex w-fit items-center gap-1">
                            <UserIcon className="h-3 w-3" />
                            普通用户
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : '从未登录'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm font-mono">
                        {user.last_login_ip || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(user.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" title="修改信息" onClick={() => openEditDialog(user)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="重置密码" onClick={() => openPasswordDialog(user)}>
                            <Key className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive hover:text-destructive" 
                            title="删除用户"
                            disabled={user.id === currentProfile?.id}
                            onClick={() => openDeleteDialog(user)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 新增用户对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增系统用户</DialogTitle>
            <DialogDescription>新创建的用户默认身份为普通用户。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="create-username">用户名 <span className="text-destructive">*</span></Label>
              <Input
                id="create-username"
                placeholder="只允许字母、数字和下划线"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-email">真实邮箱 (选填)</Label>
              <Input
                id="create-email"
                type="email"
                placeholder="用于找回密码或接收通知"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-password">初始密码 <span className="text-destructive">*</span></Label>
              <Input
                id="create-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={processing}>
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑用户对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑用户信息</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-username">用户名</Label>
              <Input
                id="edit-username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-role">用户身份</Label>
              <Select 
                value={formData.role} 
                onValueChange={(value: any) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择身份" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">普通用户</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>取消</Button>
            <Button onClick={handleEdit} disabled={processing}>
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置密码对话框 */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重置用户密码</DialogTitle>
            <DialogDescription>
              正在重置用户 <span className="font-bold">{selectedUser?.username}</span> 的密码。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reset-password">新密码</Label>
              <Input
                id="reset-password"
                type="password"
                placeholder="输入新密码"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>取消</Button>
            <Button onClick={handleResetPassword} disabled={processing}>
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              重置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除用户？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可撤销。将永久删除用户 <span className="font-bold">{selectedUser?.username}</span> 及其所有的关联数据。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => { e.preventDefault(); handleDelete(); }} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={processing}
            >
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
