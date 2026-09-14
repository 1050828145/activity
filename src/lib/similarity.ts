/**
 * 文本相似度计算工具
 * 用于快速入口功能的关键词匹配
 */

/**
 * 计算两个字符串的编辑距离（Levenshtein距离）
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const dp: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // 删除
          dp[i][j - 1] + 1,     // 插入
          dp[i - 1][j - 1] + 1  // 替换
        );
      }
    }
  }

  return dp[len1][len2];
}

/**
 * 获取中文拼音首字母
 */
function getPinyinInitials(text: string): string {
  const pinyinMap: Record<string, string> = {
    '啊': 'a', '八': 'b', '擦': 'c', '打': 'd', '额': 'e',
    '发': 'f', '噶': 'g', '哈': 'h', '击': 'j', '喀': 'k',
    '拉': 'l', '妈': 'm', '那': 'n', '哦': 'o', '啪': 'p',
    '七': 'q', '然': 'r', '撒': 's', '他': 't', '挖': 'w',
    '西': 'x', '呀': 'y', '杂': 'z'
  };

  return text
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 19968 && code <= 40869) {
        // 中文字符范围
        for (const [key, value] of Object.entries(pinyinMap)) {
          if (char >= key) {
            return value;
          }
        }
        return '';
      }
      return char.toLowerCase();
    })
    .join('');
}

/**
 * 计算关键词在文本中的匹配得分
 */
export function calculateMatchScore(keyword: string, text: string): number {
  if (!text || !keyword) return 0;

  const lowerKeyword = keyword.toLowerCase();
  const lowerText = text.toLowerCase();

  // 1. 完全匹配（最高分：10分）
  if (lowerText === lowerKeyword) {
    return 10;
  }

  // 2. 包含匹配（高分：5-8分）
  if (lowerText.includes(lowerKeyword)) {
    // 匹配位置越靠前，分数越高
    const position = lowerText.indexOf(lowerKeyword);
    const positionScore = Math.max(0, 3 - position / 10);
    return 5 + positionScore;
  }

  // 3. 拼音首字母匹配（中分：3分）
  const textInitials = getPinyinInitials(text);
  const keywordInitials = getPinyinInitials(keyword);
  if (textInitials.includes(keywordInitials)) {
    return 3;
  }

  // 4. 模糊匹配（低分：1-2分）
  const distance = levenshteinDistance(lowerKeyword, lowerText);
  const maxLen = Math.max(lowerKeyword.length, lowerText.length);
  const similarity = 1 - distance / maxLen;
  
  if (similarity > 0.6) {
    return 2;
  } else if (similarity > 0.4) {
    return 1;
  }

  return 0;
}

/**
 * 计算活动与关键词的综合相似度得分
 */
export interface ActivityMatchResult {
  id: string;
  name: string;
  score: number;
  matchedFields: string[];
  highlights: Record<string, string>;
}

export function calculateActivityScore(
  activity: any,
  keywords: string[]
): ActivityMatchResult {
  let totalScore = 0;
  const matchedFields: string[] = [];
  const highlights: Record<string, string> = {};

  // 定义字段权重
  const fieldWeights: Record<string, number> = {
    name: 3.0,           // 活动名称权重最高
    content: 2.0,        // 活动内容
    location: 1.5,       // 活动地点
    activity_type_name: 1.5,  // 活动类型
    requirements: 1.0,   // 人员要求
    notes: 1.0,          // 备注
  };

  // 遍历每个关键词
  keywords.forEach((keyword) => {
    // 遍历每个字段
    Object.entries(fieldWeights).forEach(([field, weight]) => {
      const fieldValue = activity[field];
      if (fieldValue) {
        const score = calculateMatchScore(keyword, fieldValue);
        if (score > 0) {
          totalScore += score * weight;
          if (!matchedFields.includes(field)) {
            matchedFields.push(field);
          }
          // 记录高亮信息
          if (!highlights[field]) {
            highlights[field] = highlightKeyword(fieldValue, keyword);
          }
        }
      }
    });
  });

  return {
    id: activity.id,
    name: activity.name,
    score: totalScore,
    matchedFields,
    highlights,
  };
}

/**
 * 高亮关键词
 */
export function highlightKeyword(text: string, keyword: string): string {
  if (!text || !keyword) return text;

  const regex = new RegExp(`(${keyword})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

/**
 * 搜索活动并返回前N个最匹配的结果
 * 如果找不到结果，自动拆分关键词再次搜索
 */
export function searchActivities(
  activities: any[],
  searchText: string,
  limit: number = 3
): ActivityMatchResult[] {
  if (!searchText || !activities || activities.length === 0) {
    return [];
  }

  // 分词：按空格、逗号、顿号分割
  const keywords = searchText
    .split(/[\s,，、]+/)
    .filter((k) => k.trim().length > 0);

  if (keywords.length === 0) {
    return [];
  }

  // 第一次搜索：使用所有关键词
  let results = activities
    .map((activity) => calculateActivityScore(activity, keywords))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // 如果找不到结果或结果太少，尝试拆分关键词单独搜索
  if (results.length === 0 && keywords.length === 1 && keywords[0].length > 1) {
    // 将单个关键词拆分成单字
    const chars = keywords[0].split('').filter((c) => c.trim().length > 0);
    
    if (chars.length > 1) {
      results = activities
        .map((activity) => calculateActivityScore(activity, chars))
        .filter((result) => result.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    }
  }

  // 如果还是找不到结果，尝试每个关键词单独搜索并合并结果
  if (results.length === 0 && keywords.length > 1) {
    const allResults: ActivityMatchResult[] = [];
    const seenIds = new Set<string>();

    keywords.forEach((keyword) => {
      const keywordResults = activities
        .map((activity) => calculateActivityScore(activity, [keyword]))
        .filter((result) => result.score > 0 && !seenIds.has(result.id))
        .sort((a, b) => b.score - a.score);

      keywordResults.forEach((result) => {
        if (allResults.length < limit && !seenIds.has(result.id)) {
          allResults.push(result);
          seenIds.add(result.id);
        }
      });
    });

    results = allResults;
  }

  return results;
}
