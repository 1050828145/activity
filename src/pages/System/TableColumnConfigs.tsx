import { useState, useEffect } from 'react';
import { Settings, GripVertical, Eye, EyeOff, Save, Ruler } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { getAllTableColumnConfigs, batchUpdateTableColumnConfigs } from '@/db/api';
import type { TableColumnConfig } from '@/types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// 页面配置
const PAGE_OPTIONS = [
  { value: 'activities', label: '活动管理' },
  { value: 'persons', label: '人员管理' },
  { value: 'leaders', label: '领队管理' },
  { value: 'participations', label: '参与人员管理' },
];

interface SortableItemProps {
  config: TableColumnConfig;
  onToggleVisible: (id: string, visible: boolean) => void;
  onWidthChange: (id: string, width: number | null) => void;
}

function SortableItem({ config, onToggleVisible, onWidthChange }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: config.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-card border rounded-lg hover:bg-accent/50 transition-colors"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      
      <div className="flex-1">
        <p className="font-medium">{config.column_label}</p>
        <p className="text-sm text-muted-foreground">{config.column_key}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Ruler className="h-4 w-4 text-muted-foreground" />
          <Input
            type="number"
            placeholder="宽度"
            value={config.width || ''}
            onChange={(e) => {
              const value = e.target.value;
              onWidthChange(config.id, value ? parseInt(value) : null);
            }}
            className="w-20 h-8"
            min="50"
            max="500"
          />
          <span className="text-xs text-muted-foreground">px</span>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={config.visible}
            onCheckedChange={(checked) => onToggleVisible(config.id, checked)}
          />
          {config.visible ? (
            <Eye className="h-4 w-4 text-green-500" />
          ) : (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>
    </div>
  );
}

export default function TableColumnConfigs() {
  const [allConfigs, setAllConfigs] = useState<TableColumnConfig[]>([]);
  const [selectedPage, setSelectedPage] = useState<string>('activities');
  const [pageConfigs, setPageConfigs] = useState<TableColumnConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadConfigs();
  }, []);

  useEffect(() => {
    filterPageConfigs();
  }, [selectedPage, allConfigs]);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const data = await getAllTableColumnConfigs();
      setAllConfigs(data);
    } catch (error: any) {
      toast.error(error.message || '加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  const filterPageConfigs = () => {
    const filtered = allConfigs.filter((c) => c.page_name === selectedPage);
    setPageConfigs(filtered);
    setHasChanges(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setPageConfigs((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // 更新 order_index
        return newItems.map((item, index) => ({
          ...item,
          order_index: index + 1,
        }));
      });
      setHasChanges(true);
    }
  };

  const handleToggleVisible = (id: string, visible: boolean) => {
    setPageConfigs((items) =>
      items.map((item) =>
        item.id === id ? { ...item, visible } : item
      )
    );
    setHasChanges(true);
  };

  const handleWidthChange = (id: string, width: number | null) => {
    setPageConfigs((items) =>
      items.map((item) =>
        item.id === id ? { ...item, width } : item
      )
    );
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const updates = pageConfigs.map((config) => ({
        id: config.id,
        visible: config.visible,
        order_index: config.order_index,
        width: config.width,
      }));

      await batchUpdateTableColumnConfigs(updates);
      
      // 更新本地状态
      setAllConfigs((configs) =>
        configs.map((config) => {
          const updated = pageConfigs.find((p) => p.id === config.id);
          return updated || config;
        })
      );

      setHasChanges(false);
      toast.success('配置保存成功');
    } catch (error: any) {
      toast.error(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    filterPageConfigs();
    toast.info('已重置为上次保存的配置');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">列表配置</h1>
          <p className="text-muted-foreground mt-2">
            配置每个页面列表的列显示和顺序
          </p>
        </div>
        <Settings className="h-8 w-8 text-muted-foreground" />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>选择页面</CardTitle>
          <CardDescription>
            选择要配置的页面，然后调整列的显示和顺序
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>页面</Label>
            <Select value={selectedPage} onValueChange={setSelectedPage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              加载中...
            </div>
          </CardContent>
        </Card>
      ) : pageConfigs.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              该页面暂无配置
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>列配置</CardTitle>
                <CardDescription>
                  拖拽调整顺序，切换开关控制显示/隐藏，设置列宽度（像素）
                </CardDescription>
              </div>
              {hasChanges && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleReset}>
                    重置
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? '保存中...' : '保存配置'}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={pageConfigs.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {pageConfigs.map((config) => (
                    <SortableItem
                      key={config.id}
                      config={config}
                      onToggleVisible={handleToggleVisible}
                      onWidthChange={handleWidthChange}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {!hasChanges && (
              <p className="text-sm text-muted-foreground mt-4 text-center">
                💡 提示：拖拽列可以调整顺序，切换开关可以控制显示/隐藏，输入数字可以设置列宽度
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
