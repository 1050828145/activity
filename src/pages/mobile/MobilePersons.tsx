import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Plus, Search, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPersons } from '@/db/api';
import type { Person } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function MobilePersons() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [filteredPersons, setFilteredPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadPersons();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = persons.filter(
        (person) =>
          person.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          person.contact?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredPersons(filtered);
    } else {
      setFilteredPersons(persons);
    }
  }, [searchTerm, persons]);

  const loadPersons = async () => {
    try {
      setLoading(true);
      const data = await getPersons();
      setPersons(data);
      setFilteredPersons(data);
    } catch (error) {
      console.error('加载人员失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-10 w-full bg-muted" />
        <Skeleton className="h-10 w-full bg-muted" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 头部 */}
      <div className="sticky top-0 z-10 bg-card border-b border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">人员管理</h1>
          <Link to="/persons/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              新建
            </Button>
          </Link>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索姓名或联系方式..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* 人员列表 */}
      <div className="p-4 space-y-3">
        {filteredPersons.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {searchTerm ? '没有找到匹配的人员' : '暂无人员，点击右上角新建'}
            </CardContent>
          </Card>
        ) : (
          filteredPersons.map((person) => (
            <Link key={person.id} to={`/persons/${person.id}`}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{person.name}</h3>
                      {person.contact && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <Phone className="h-3 w-3" />
                          <span>{person.contact}</span>
                        </div>
                      )}
                    </div>
                    <Badge variant="outline">{person.gender || '未知'}</Badge>
                  </div>
                  {person.expertise && (
                    <div className="flex flex-wrap gap-1 pt-2 border-t border-border">
                      {person.expertise.split(',').slice(0, 3).map((skill, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {skill.trim()}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
