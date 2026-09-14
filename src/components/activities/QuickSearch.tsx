import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface QuickSearchProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

export default function QuickSearch({ value, onChange, onClear }: QuickSearchProps) {
  return (
    <div className="relative flex-1 max-w-md">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        type="text"
        placeholder="快速入口：输入关键词搜索活动（多个关键词用空格分隔）..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-8 pr-8 h-9 text-sm"
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0.5 top-1/2 -translate-y-1/2 h-6 w-6"
          onClick={onClear}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
