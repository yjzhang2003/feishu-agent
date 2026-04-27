# Feishu Agent — 基于 Claude Code 的飞书智能助手

## 项目简介

Feishu Agent 是一个基于 Claude Code CLI 和飞书（Lark）的智能对话助手，能够：

1. **智能对话**：通过飞书直接与 Claude AI 对话
2. **自动修复**：分析错误日志，生成修复代码，自动提交 PR
3. **Traceback 监控**：轮询注册服务的日志端点，自动检测并修复新错误
4. **飞书集成**：完整的 lark-cli 技能支持

## 架构设计

本项目采用 **WebSocket + Claude Code Skills** 架构：

```
飞书 App
    │
    │ 扫码添加 Bot
    ▼
┌─────────────────────────────┐
│  WebSocket 长连接            │
│  (lark_oapi SDK)            │
└──────────┬──────────────────┘
           │ 消息事件
           ▼
┌─────────────────────────────┐
│  Feishu Agent               │
│  ├── 消息处理               │
│  ├── ACK 表情反馈           │
│  ├── Skill 调用             │
│  └── TracebackMonitor       │
│      └── 自动轮询 → 触发修复 │
└──────────┬──────────────────┘
           │ claude -p
           ▼
┌─────────────────────────────┐
│  Claude Code CLI            │
│  ├── 读取 Skills            │
│  ├── 调用 lark-cli 回复     │
│  └── 会话上下文管理          │
└─────────────────────────────┘
```

## 特性

- **无需公网 URL**：使用 WebSocket 长连接，无需配置 Webhook
- **扫码即用**：QR 扫码自动创建 Bot 应用
- **会话隔离**：每个飞书聊天独立会话上下文
- **ACK 反馈**：收到消息立即发送 OK 表情确认
- **Markdown 支持**：消息支持完整的 Markdown 格式
- **服务注册表**：通过 TUI 或飞书命令注册需要监控的服务
- **自动修复闭环**：检测 traceback → 分析 → 修复 → 提交 PR → 飞书通知

## 技术栈

- **语言**: TypeScript + Node.js
- **CLI 框架**: Ink (React for CLI)
- **飞书集成**: @larksuiteoapi/node-sdk + lark-cli
- **Agent**: Claude Code CLI + Standard Skills

## 项目结构

```
feishu-agent/
├── src/
│   ├── cli/                       # 交互式 CLI (Ink)
│   │   ├── components/            # CLI 组件
│   │   │   ├── ServiceManageScreen.tsx   # 服务管理 TUI
│   │   │   └── ...
│   │   └── index.tsx              # 配置界面
│   ├── feishu/                    # 飞书模块
│   │   ├── websocket-connector.ts # WebSocket 连接 + /service 命令
│   │   ├── qr-onboarding.ts       # QR 扫码注册
│   │   ├── card.ts                # 飞书卡片构建
│   │   └── lark-auth.ts           # lark-cli 认证
│   ├── monitor/                   # 监控模块
│   │   └── traceback-monitor.ts   # Traceback 轮询监控
│   ├── service/                   # 服务注册表
│   │   ├── registry.ts            # CRUD + 哈希去重
│   │   └── registry.test.ts       # 单元测试
│   ├── trigger/                   # 触发器
│   │   ├── trigger.ts             # 触发文件读写
│   │   └── invoker.ts             # 调用 Claude CLI
│   └── config/                    # 配置
│       └── env.ts                 # 环境变量
├── workspace/
│   └── .claude/                   # Claude Code 工作目录
│       ├── settings.json          # Claude 配置
│       ├── services.json          # 服务注册表
│       ├── sessions/              # 会话文件
│       └── skills/                # Skills 目录
│           ├── lark-chat-guide/   # 聊天助手行为规范
│           ├── lark-im/           # 即时通讯
│           ├── lark-doc/          # 文档操作
│           ├── auto-repair/       # 自动修复
│           ├── notify-feishu/     # 飞书通知
│           ├── service-manager/   # 服务管理
│           └── ...                # 更多 Lark Skills
└── package.json
```

## 快速开始

### 前置要求

- Node.js 18+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code/installation)
- [lark-cli](https://github.com/larksuite/cli)

### 安装

```bash
npm install
npm run build
```

### 配置

运行交互式配置 CLI：

```bash
npm run cli
```

CLI 会引导你完成：
1. **Claude Code** - 检测安装状态
2. **Feishu** - QR 扫码认证（推荐）
3. **GitHub** - 检测 gh CLI
4. **Service** - 启动后台服务 / 管理服务注册表

### 启动服务

```bash
npm start          # 前台运行
npm start:prod     # PM2 后台运行
```

## 飞书命令

在飞书中与 Bot 对话：

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助 |
| `/status` | 查看系统状态 |
| `/repair [context]` | 触发自动修复 |
| `/service add <name> <owner/repo> <traceback_url>` | 注册监控服务 |
| `/service remove <name>` | 移除服务 |
| `/service list` | 列出已注册服务 |
| `/service enable/disable <name>` | 启用/禁用监控 |
| 普通消息 | 与 Claude AI 对话 |

## 服务管理

### 方式一：TUI（推荐）

```bash
npm run cli
# → Service → Manage Services
```

### 方式二：飞书消息

```
/service add my-api myorg/my-api https://logs.example.com/api/tracebacks
/service list
/service enable my-api
```

### 方式三：Claude Code Skill

在 Claude Code 对话中：

```
/ 使用 service-manager skill 列出所有监控服务
/ 使用 service-manager skill 添加服务 my-api myorg/my-api https://logs.example.com/api/tracebacks
```

## Skills 列表

内置多个 Lark Skills：

| Skill | 描述 |
|-------|------|
| `lark-chat-guide` | 飞书聊天助手行为规范与技能导航 |
| `lark-im` | 即时通讯 |
| `lark-doc` | 文档操作 |
| `lark-sheets` | 表格操作 |
| `lark-calendar` | 日历管理 |
| `lark-drive` | 云盘操作 |
| `lark-base` | 多维表格 |
| `lark-mail` | 邮件管理 |
| `lark-vc` | 视频会议 |
| `lark-whiteboard` | 白板 |
| `lark-approval` | 审批 |
| `lark-attendance` | 考勤 |
| `auto-repair` | 自动修复（多服务支持） |
| `notify-feishu` | 飞书卡片通知 |
| `service-manager` | 服务注册表管理 |
| `analyze-log` | 日志分析 |
| `safety-check` | 安全检查 |

## 开发命令

```bash
npm run cli          # 配置 CLI（含服务管理）
npm start            # 启动服务
npm run start:prod   # PM2 后台运行
npm stop             # 停止服务
npm restart          # 重启服务
npm run logs         # 查看日志
npm run build        # 构建
npm test             # 测试
npm run typecheck    # 类型检查
```

## PM2 管理

服务使用 PM2 管理：

```bash
npm run start:prod   # 启动
npm stop             # 停止
npm restart          # 重启
npm run logs         # 日志
npm run status       # 状态
```

## 扩展 Skill

在 `workspace/.claude/skills/` 下创建：

```
workspace/.claude/skills/my-skill/
└── SKILL.md
```

SKILL.md 格式：

```yaml
---
name: my-skill
description: 功能描述
---

# 协议

## Procedure
1. 步骤一
2. 步骤二
```

## License

MIT
