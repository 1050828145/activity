import { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import LeaderSearchDialog from '@/components/common/LeaderSearchDialog';
import type { Leader } from '@/types';

interface ParticipantDetailFormProps {
  leaders: Leader[];
  onSubmit: (data: {
    status: string;
    salary?: number;
    deposit: number;
    per_head_fee?: number;
    introducer_id?: string | null;
    is_paid: boolean;
    added_at?: string;
  }) => void;
  onCancel: () => void;
  defaultValues?: {
    status?: string;
    salary?: number;
    deposit?: number;
    per_head_fee?: number;
    introducer_id?: string;
    is_paid?: boolean;
    added_at?: string;
  };
}

const statusOptions = ['待确认', '已确认', '已出席', '已合格', '未出席', '已取消'];

export default function ParticipantDetailForm({
  leaders,
  onSubmit,
  onCancel,
  defaultValues,
}: ParticipantDetailFormProps) {
  const [status, setStatus] = useState(defaultValues?.status || '已确认');
  const [salary, setSalary] = useState(defaultValues?.salary?.toString() || '');
  const [deposit, setDeposit] = useState(defaultValues?.deposit?.toString() || '0');
  const [perHeadFee, setPerHeadFee] = useState(defaultValues?.per_head_fee?.toString() || '');
  const [isPaid, setIsPaid] = useState(defaultValues?.is_paid || false);
  const [addedAt, setAddedAt] = useState(
    defaultValues?.added_at 
      ? new Date(defaultValues.added_at).toISOString().slice(0, 16) 
      : new Date().toISOString().slice(0, 16)
  );
  const [selectedLeader, setSelectedLeader] = useState<Leader | null>(null);
  const [leaderDialogOpen, setLeaderDialogOpen] = useState(false);

  // 初始化选中的领队
  useEffect(() => {
    if (defaultValues?.introducer_id && leaders.length > 0) {
      const leader = leaders.find(l => l.id === defaultValues.introducer_id);
      if (leader) {
        setSelectedLeader(leader);
      }
    } else if (!defaultValues?.introducer_id) {
      // 如果没有默认值,清空选择
      setSelectedLeader(null);
    }
  }, [defaultValues?.introducer_id, leaders]);

  const handleSubmit = () => {
    onSubmit({
      status,
      salary: salary ? parseFloat(salary) : undefined,
      deposit: parseFloat(deposit) || 0,
      per_head_fee: perHeadFee ? parseFloat(perHeadFee) : undefined,
      introducer_id: selectedLeader?.id || null,
      is_paid: isPaid,
      added_at: new Date(addedAt).toISOString(),
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>参与状态 *</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>工资</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="请输入工资"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>押金</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="请输入押金"
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>人头费</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="请输入人头费"
            value={perHeadFee}
            onChange={(e) => setPerHeadFee(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>添加时间 *</Label>
        <Input
          type="datetime-local"
          value={addedAt}
          onChange={(e) => setAddedAt(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>介绍人(领队)</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1 justify-start"
            onClick={() => setLeaderDialogOpen(true)}
          >
            <Search className="h-4 w-4 mr-2" />
            {selectedLeader ? `${selectedLeader.name} - ${selectedLeader.contact}` : '点击选择介绍人'}
          </Button>
          {selectedLeader && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setSelectedLeader(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>是否发薪</Label>
        <Select value={isPaid ? 'true' : 'false'} onValueChange={(value) => setIsPaid(value === 'true')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="false">未发薪</SelectItem>
            <SelectItem value="true">已发薪</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          取消
        </Button>
        <Button onClick={handleSubmit}>
          确定
        </Button>
      </div>

      <LeaderSearchDialog
        open={leaderDialogOpen}
        onOpenChange={setLeaderDialogOpen}
        onSelect={setSelectedLeader}
        selectedLeader={selectedLeader}
      />
    </div>
  );
}
