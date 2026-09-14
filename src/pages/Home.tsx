import { ExternalLink, Share2, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';

interface WebsiteLink {
  id: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string;
}

export default function Home() {
  const [copied, setCopied] = useState(false);

  const websiteLinks: WebsiteLink[] = [
    {
      id: '1',
      title: '移动端管理',
      description: '快速创建和管理活动、人员及参与记录',
      url: '/mobile',
      imageUrl: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400&h=300&fit=crop',
    },
    {
      id: '2',
      title: '数据统计',
      description: '查看活动和人员的详细统计数据',
      url: '/dashboard',
      imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop',
    },
    {
      id: '3',
      title: '活动管理',
      description: '管理所有活动信息和参与人员',
      url: '/activities',
      imageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=300&fit=crop',
    },
    {
      id: '4',
      title: '人员管理',
      description: '管理人员信息和参与历史',
      url: '/persons',
      imageUrl: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=400&h=300&fit=crop',
    },
  ];

  const handleLinkClick = (url: string) => {
    if (url.startsWith('http')) {
      window.open(url, '_blank');
    } else {
      window.location.href = url;
    }
  };

  // 服务器正式发布地址：构建时由平台环境变量 EXTERNAL_SERVICE_VITESANDBOX 注入
  // 该域名与代码版本无关，只要应用在运行即永久有效
  const PUBLISHED_URL: string =
    (typeof __PUBLISHED_URL__ !== 'undefined' && __PUBLISHED_URL__)
      ? __PUBLISHED_URL__
      : window.location.origin;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(PUBLISHED_URL);
      setCopied(true);
      toast.success('链接已复制');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
      toast.error('复制失败，请手动复制');
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: '活动与人员管理系统',
      text: '一款专为活动接单及人员招聘场景设计的管理系统',
      url: PUBLISHED_URL,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        toast.success('分享成功');
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          await handleCopyLink();
        }
      }
    } else {
      await handleCopyLink();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">主页</h1>
          <p className="text-muted-foreground mt-2">快速访问常用功能和相关网站</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCopyLink}>
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2 text-green-600" />
                已复制
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                复制链接
              </>
            )}
          </Button>
          <Button onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-2" />
            分享网站
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {websiteLinks.map((link) => (
          <Card
            key={link.id}
            className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden group"
            onClick={() => handleLinkClick(link.url)}
          >
            <div className="relative h-48 overflow-hidden">
              <img
                src={link.imageUrl}
                alt={link.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  {link.title}
                  <ExternalLink className="h-4 w-4" />
                </h3>
              </div>
            </div>
            <CardHeader>
              <CardDescription>{link.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">移动端管理</h4>
            <p className="text-sm text-muted-foreground">
              专为移动设备优化的管理界面，支持快速创建和批量修改活动、人员及参与记录。
              适合在现场使用手机进行数据录入和管理。
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">桌面端管理</h4>
            <p className="text-sm text-muted-foreground">
              完整的管理功能，包括数据统计、详细查询、批量导入导出等高级功能。
              适合在办公室使用电脑进行全面的数据管理和分析。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
