import { useState, useEffect } from 'react';
import { Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getAllParticipantsWithDetails } from '@/db/api';
import { Skeleton } from '@/components/ui/skeleton';

const statusColors: Record<string, string> = {
  '待确认': 'bg-yellow-500',
  '已确认': 'bg-blue-500',
  '已出席': 'bg-green-500',
  '未出席': 'bg-gray-500',
  '已取消': 'bg-red-500',
};

export default function MobileParticipations() {
  const [participants, setParticipants] = useState<any[]>([]);
  const [filteredParticipants, setFilteredParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadParticipants();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, statusFilter, participants]);

  const loadParticipants = async () => {
    try {
      setLoading(true);
      const data = await getAllParticipantsWithDetails();
      setParticipants(data);
      setFilteredParticipants(data);
    } catch (error) {
      console.error('加载参与记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...participants];

    if (searchTerm) {
      filtered = filtered.filter(
        (p) =>
          p.person_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.activity_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }

    setFilteredParticipants(filtered);
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-10 w-full bg-muted" />
        <Skeleton className="h-10 w-full bg-muted" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 头部 */}
      <div className="sticky top-0 z-10 bg-card border-b border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">参与记录</h1>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-1" />
            筛选
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索人员或活动..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {showFilters && (
          <div className="space-y-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="选择状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="待确认">待确认</SelectItem>
                <SelectItem value="已确认">已确认</SelectItem>
                <SelectItem value="已出席">已出席</SelectItem>
                <SelectItem value="未出席">未出席</SelectItem>
                <SelectItem value="已取消">已取消</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* 参与记录列表 */}
      <div className="p-4 space-y-3">
        {filteredParticipants.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {searchTerm || statusFilter !== 'all' ? '没有找到匹配的记录' : '暂无参与记录'}
            </CardContent>
          </Card>
        ) : (
          filteredParticipants.map((participant) => (
            <Card key={participant.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">
                      {participant.person_name}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {participant.activity_name}
                    </p>
                  </div>
                  <Badge className={statusColors[participant.status] || 'bg-muted'}>
                    {participant.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                  <span className="text-muted-foreground">
                    {participant.activity_date}
                  </span>
                  <div className="flex gap-2">
                    {participant.salary && (
                      <Badge variant="outline">¥{participant.salary}</Badge>
                    )}
                    <Badge variant={participant.is_paid ? 'default' : 'secondary'}>
                      {participant.is_paid ? '已发薪' : '未发薪'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
