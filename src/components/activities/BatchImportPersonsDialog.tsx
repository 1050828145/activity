import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Upload, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { generatePersonImportTemplate, parsePersonImportExcel, type PersonImportData } from '@/utils/personImportExcel';
import { getPersonByContact, createPerson, addParticipantsToActivity } from '@/db/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Activity } from '@/types';

interface BatchImportPersonsDialogProps {
  activity: Activity;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ImportResult {
  success: number;
  failed: number;
  details: string[];
}

export default function BatchImportPersonsDialog({
  activity,
  open,
  onOpenChange,
  onSuccess,
}: BatchImportPersonsDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleDownloadTemplate = () => {
    generatePersonImportTemplate();
    toast.success('模板下载成功');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('请上传Excel文件(.xlsx或.xls)');
      return;
    }

    // 验证文件大小(最大5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('文件大小不能超过5MB');
      return;
    }

    try {
      setUploading(true);
      setImportResult(null);

      // 解析Excel文件
      const persons = await parsePersonImportExcel(file);
      
      if (persons.length === 0) {
        toast.error('Excel文件中没有有效数据');
        return;
      }

      // 处理导入
      const result: ImportResult = {
        success: 0,
        failed: 0,
        details: [],
      };

      const participantsToAdd: Array<{ personId: string; details: any }> = [];

      for (const personData of persons) {
        try {
          // 检查人员是否已存在
          let person = await getPersonByContact(personData.contact);
          
          // 如果不存在，创建新人员
          if (!person) {
            person = await createPerson({
              name: personData.name,
              contact: personData.contact,
              gender: personData.gender,
              age: personData.age,
              id_number: personData.id_number,
              expertise: personData.expertise,
              notes: personData.notes,
            });
            result.details.push(`✓ 创建新人员: ${personData.name} (${personData.contact})`);
          } else {
            result.details.push(`○ 使用已有人员: ${personData.name} (${personData.contact})`);
          }

          // 准备参与记录数据
          participantsToAdd.push({
            personId: person.id,
            details: {
              status: personData.status || '待确认',
              salary: personData.wage ?? activity.part_time_salary,
              deposit: personData.deposit ?? activity.deposit,
              per_head_fee: personData.commission ?? activity.per_head_fee,
            },
          });

          result.success++;
        } catch (error: any) {
          result.failed++;
          result.details.push(`✗ 失败: ${personData.name} - ${error.message}`);
        }
      }

      // 批量添加参与记录
      if (participantsToAdd.length > 0) {
        try {
          await addParticipantsToActivity(activity.id, participantsToAdd);
          result.details.push(`\n✓ 成功添加 ${participantsToAdd.length} 条参与记录`);
        } catch (error: any) {
          result.details.push(`\n✗ 添加参与记录失败: ${error.message}`);
          result.failed = persons.length;
          result.success = 0;
        }
      }

      setImportResult(result);

      if (result.success > 0) {
        toast.success(`成功导入 ${result.success} 条数据`);
        onSuccess();
      } else {
        toast.error('导入失败');
      }
    } catch (error: any) {
      console.error('导入失败:', error);
      toast.error(error.message || '导入失败');
    } finally {
      setUploading(false);
      // 清空文件选择
      e.target.value = '';
    }
  };

  const handleClose = () => {
    setImportResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>批量导入人员 - {activity.name}</DialogTitle>
          <DialogDescription>
            下载模板填写人员信息后上传，系统会自动创建新人员并添加到活动中
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 下载模板 */}
          <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/50">
            <div>
              <h4 className="font-medium">步骤1: 下载导入模板</h4>
              <p className="text-sm text-muted-foreground mt-1">
                模板包含示例数据，请参考填写
              </p>
            </div>
            <Button onClick={handleDownloadTemplate} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              下载模板
            </Button>
          </div>

          {/* 上传文件 */}
          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div>
              <h4 className="font-medium">步骤2: 上传填写好的文件</h4>
              <p className="text-sm text-muted-foreground mt-1">
                支持.xlsx和.xls格式，最大5MB
              </p>
            </div>
            <div>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
                id="import-file"
              />
              <label htmlFor="import-file">
                <Button asChild disabled={uploading}>
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading ? '导入中...' : '选择文件'}
                  </span>
                </Button>
              </label>
            </div>
          </div>

          {/* 导入结果 */}
          {importResult && (
            <Alert variant={importResult.failed > 0 ? 'destructive' : 'default'}>
              <div className="flex items-start gap-2">
                {importResult.failed > 0 ? (
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mt-0.5" />
                )}
                <div className="flex-1">
                  <AlertDescription>
                    <div className="font-medium mb-2">
                      导入完成: 成功 {importResult.success} 条，失败 {importResult.failed} 条
                    </div>
                    <div className="text-sm space-y-1 max-h-60 overflow-y-auto">
                      {importResult.details.map((detail, index) => (
                        <div key={index} className="whitespace-pre-wrap">
                          {detail}
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}

          {/* 说明 */}
          <div className="text-sm text-muted-foreground space-y-2 p-4 bg-muted/30 rounded-lg">
            <p className="font-medium">导入说明:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>姓名和联系方式为必填项</li>
              <li>系统会根据联系方式判断人员是否已存在</li>
              <li>已存在的人员不会重复创建，直接添加到活动中</li>
              <li>工资、押金、人头费如不填写，将使用活动默认值</li>
              <li>参与状态可选: 待确认、已确认、已出席、已合格、未出席、已取消</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
