import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search } from 'lucide-react';
import { getPersons } from '@/db/api';
import type { Person } from '@/types';
import { toast } from 'sonner';

interface ParticipantSelectorProps {
  selectedIds: string[];
  onConfirm: (selectedIds: string[]) => void;
  onCancel: () => void;
}

export default function ParticipantSelector({ selectedIds, onConfirm, onCancel }: ParticipantSelectorProps) {
  const [persons, setPersons] = useState<Person[]>([]);
  const [filteredPersons, setFilteredPersons] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPersons();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = persons.filter(
        (person) =>
          person.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          person.contact.includes(searchQuery)
      );
      setFilteredPersons(filtered);
    } else {
      setFilteredPersons(persons);
    }
  }, [searchQuery, persons]);

  const loadPersons = async () => {
    try {
      setLoading(true);
      const data = await getPersons();
      setPersons(data);
      setFilteredPersons(data);
    } catch (error) {
      console.error('加载人员列表失败:', error);
      toast.error('加载人员列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (personId: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(personId)) {
      newSelected.delete(personId);
    } else {
      newSelected.add(personId);
    }
    setSelected(newSelected);
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selected));
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索人员姓名或联系方式"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="border border-border rounded-lg max-h-96 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">加载中...</div>
        ) : filteredPersons.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {searchQuery ? '未找到匹配的人员' : '暂无人员数据'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredPersons.map((person) => (
              <div
                key={person.id}
                className="flex items-center gap-3 p-4 hover:bg-accent cursor-pointer transition-colors"
                onClick={() => handleToggle(person.id)}
              >
                <Checkbox
                  checked={selected.has(person.id)}
                  onCheckedChange={() => handleToggle(person.id)}
                />
                <Avatar className="h-10 w-10">
                  <AvatarImage src={person.photo_url} alt={person.name} />
                  <AvatarFallback>{person.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{person.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{person.contact}</p>
                </div>
                {person.expertise && (
                  <span className="text-xs text-muted-foreground">{person.expertise}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          已选择 {selected.size} 人
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button onClick={handleConfirm}>
            确认
          </Button>
        </div>
      </div>
    </div>
  );
}
