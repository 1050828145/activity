import { useMemo, useState } from 'react';
import { Check, X, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import type { Activity } from '@/types';

interface ActivityMultiSelectProps {
  activities: Activity[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function ActivityMultiSelect({
  activities,
  value = '',
  onChange,
  placeholder = '选择活动',
  disabled,
}: ActivityMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedIds = useMemo(() => {
    return value
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }, [value]);

  const selectedActivities = useMemo(() => {
    return activities.filter((a) => selectedIds.includes(a.id));
  }, [activities, selectedIds]);

  const toggleActivity = (activityId: string) => {
    const set = new Set(selectedIds);
    if (set.has(activityId)) {
      set.delete(activityId);
    } else {
      set.add(activityId);
    }
    onChange(Array.from(set).join(','));
  };

  const removeActivity = (e: React.MouseEvent, activityId: string) => {
    e.stopPropagation();
    toggleActivity(activityId);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between min-h-10 h-auto py-2"
          disabled={disabled}
        >
          <div className="flex flex-wrap items-center gap-1.5 overflow-hidden">
            {selectedActivities.length === 0 ? (
              <span className="text-muted-foreground font-normal">{placeholder}</span>
            ) : (
              selectedActivities.map((activity) => (
                <Badge
                  key={activity.id}
                  variant="secondary"
                  className="flex items-center gap-1 px-1.5 py-0.5 text-xs"
                >
                  <span className="truncate max-w-[140px]">{activity.name}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => removeActivity(e, activity.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleActivity(activity.id);
                      }
                    }}
                    className="ml-0.5 rounded-sm outline-none hover:bg-muted-foreground/20 p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </Badge>
              ))
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="搜索活动..." />
          <CommandList>
            <CommandEmpty>未找到匹配活动</CommandEmpty>
            <CommandGroup>
              {activities.map((activity) => {
                const selected = selectedIds.includes(activity.id);
                return (
                  <CommandItem
                    key={activity.id}
                    value={`${activity.name} ${activity.id}`}
                    onSelect={() => toggleActivity(activity.id)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        selected ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="truncate">{activity.name}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
