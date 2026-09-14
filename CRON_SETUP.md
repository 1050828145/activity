# 定时邮件发送自动化配置指南

## 快速测试

在配置自动化之前，可以先测试 Edge Function 是否正常工作：

```bash
# 方法 1：使用项目中的测试脚本
./test-cron.sh

# 方法 2：直接使用 curl
curl -X POST \
  "https://backend.appmiaoda.com/projects/supabase275158120102146048/functions/v1/send-scheduled-email" \
  -H "Content-Type: application/json" \
  -d '{}'
```

如果返回 `{"success":true,...}`，说明 Edge Function 正常工作。

---

## 方案：使用 GitHub Actions（完全免费，自动运行）

### 步骤 1：创建 GitHub 仓库

1. 访问 https://github.com/new
2. 创建一个新的私有仓库（例如：`email-scheduler`）
3. 无需添加任何文件，直接创建即可

### 步骤 2：添加 GitHub Actions 工作流

**注意：GitHub Actions 的最小执行间隔是 5 分钟，如果需要每分钟执行，请使用 cron-job.org**

1. 项目已包含工作流文件：`.github/workflows/send-email.yml`
2. 将项目推送到 GitHub 仓库即可自动启用
3. 或者手动创建文件并复制以下内容：

```yaml
name: 定时发送邮件通知

on:
  schedule:
    # 每 5 分钟执行一次（GitHub Actions 的最小间隔）
    - cron: '*/5 * * * *'
  workflow_dispatch: # 允许手动触发

jobs:
  send-emails:
    runs-on: ubuntu-latest
    steps:
      - name: 调用邮件发送 Edge Function
        run: |
          response=$(curl -s -X POST \
            "https://backend.appmiaoda.com/projects/supabase275158120102146048/functions/v1/send-scheduled-email" \
            -H "Content-Type: application/json" \
            -d '{}')
          
          echo "响应结果："
          echo "$response"
          
          if echo "$response" | grep -q '"success":true'; then
            echo "✅ 调用成功！"
          else
            echo "❌ 调用失败"
            exit 1
          fi
```

### 步骤 3：启用 GitHub Actions

1. 将代码推送到 GitHub 仓库
2. 进入仓库的 Actions 标签页
3. 如果是第一次使用，点击 "I understand my workflows, go ahead and enable them"
4. 找到 "定时发送邮件通知" 工作流
5. 点击 "Run workflow" 手动触发一次测试
6. 查看运行日志，确认是否成功

**重要提示：** GitHub Actions 的定时任务最小间隔是 5 分钟，不支持每分钟执行。如果您的通知任务需要精确到每分钟，请使用下方的 cron-job.org 方案。

### 步骤 4：验证运行

1. 进入仓库的 Actions 标签页
2. 点击最新的运行记录
3. 查看运行日志，确认是否成功调用
4. 检查邮箱是否收到邮件

---

## 替代方案：cron-job.org（推荐，支持每分钟执行）

---

## 替代方案：cron-job.org（推荐，支持每分钟执行）

**优势：**
- ✅ 完全免费，无需信用卡
- ✅ 支持每分钟执行（比 GitHub Actions 更精确）
- ✅ 配置简单，无需代码仓库
- ✅ 提供执行历史和日志

**设置步骤：**

1. **访问网站**
   - 网址：https://cron-job.org
   - 点击 "Sign up" 注册账号

2. **创建定时任务**
   - 登录后，点击 "Cronjobs" → "Create cronjob"
   - Title: `邮件通知定时任务`
   - URL: `https://backend.appmiaoda.com/projects/supabase275158120102146048/functions/v1/send-scheduled-email`
   - Request method: `POST`
   - Schedule: 选择 "Every minute" 或自定义时间
   - 点击 "Create cronjob" 保存

3. **验证运行**
   - 在 "Cronjobs" 列表中找到刚创建的任务
   - 点击任务名称查看执行历史
   - 等待下一个整分钟，检查是否成功执行

---

## 其他替代方案

### EasyCron
---

## 其他替代方案

### EasyCron
- 网址：https://www.easycron.com
- 免费计划，需邮箱验证
- 支持每分钟执行
- URL：同上
- 方法：POST

---

## 工作原理

1. 外部触发器（GitHub Actions / cron-job.org）定时调用 Edge Function
2. Edge Function 检查当前时间（精确到分钟）
3. 查询所有启用的通知任务
4. 匹配任务的发送时间和日期规则
5. 从用户个人资料中读取邮箱地址
6. 自动采集数据（报名、待办、备注）
7. 生成专业的 HTML 邮件并发送
8. 记录发送日志到数据库

**完全在后端运行，无需登录状态！**

---

## 注意事项

- ⚠️ 请确保已在"邮箱配置"中正确配置 Resend API Key
- ⚠️ 通知任务的时间精度为分钟级别
- ⚠️ 收件人邮箱从用户个人资料中读取，请确保已设置邮箱
- 💡 推荐使用 cron-job.org，支持每分钟执行且完全免费
- 💡 GitHub Actions 最小间隔是 5 分钟，适合不需要精确到分钟的场景
- 💡 所有方案都是免费的，选择最适合您的即可

---

## 常见问题

**Q: 为什么需要外部触发器？**
A: Supabase 的免费版本不支持内置的定时任务功能（pg_cron），因此需要使用外部服务定时调用 Edge Function。

**Q: 我的通知任务设置的是北京时间，但 cron-job.org 使用 UTC 时间怎么办？**
A: 不用担心！Edge Function 会自动使用服务器的当前时间进行匹配，您只需要在系统中设置正确的发送时间即可。

**Q: 如果我设置了每天 08:00 发送，但触发器是每分钟执行一次，会重复发送吗？**
A: 不会。Edge Function 只会在精确匹配的时间（08:00）发送一次，其他时间调用会返回"当前时间没有需要发送的任务"。

**Q: 我可以同时使用多个触发器吗？**
A: 可以，但没有必要。多个触发器会增加调用次数，但不会影响发送逻辑（不会重复发送）。

**Q: 免费额度够用吗？**
A: 完全够用！
  - cron-job.org: 无限制
  - GitHub Actions: 每月 2,000 分钟（每分钟执行一次，可用约 33 小时）
  - EasyCron: 免费计划每月 1,000 次执行

**Q: 如何查看发送日志？**
A: 系统会自动记录所有发送日志到 `email_send_logs` 表，您可以在数据库中查询，或者在未来的版本中我们会添加前端查看界面。
