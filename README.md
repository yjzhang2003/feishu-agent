# Feishu Agent — 基于 Claude Code 的飞书智能助手

## 项目简介

Feishu Agent 是一个基于 Claude Code CLI 和飞书（Lark）的智能对话助手，能够：

1. **智能对话**：通过飞书直接与 Claude AI 对话
2. **自动修复**：分析错误日志，生成修复代码
3. **服务监控**：健康检查、异常告警
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
│  └── Skill 调用             │
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

- ✅ **无需公网 URL**：使用 WebSocket 长连接，无需配置 Webhook
- ✅ **扫码即用**：QR 扫码自动创建 Bot 应用
- ✅ **会话隔离**：每个飞书聊天独立会话上下文
- ✅ **ACK 反馈**：收到消息立即发送 OK 表情确认
- ✅ **Markdown 支持**：消息支持完整的 Markdown 格式

## 技术栈

- **语言**: TypeScript + Node.js
- **CLI 框架**: Ink (React for CLI)
- **飞书集成**: @larksuiteoapi/node-sdk + lark-cli
- **Agent**: Claude Code CLI + Standard Skills

## 项目结构

```
feishu-agent/
├── src/
│   ├── cli/                 # 交互式 CLI (Ink)
│   │   └── index.tsx        # 配置界面
│   ├── feishu/              # 飞书模块
│   │   ├── websocket-connector.ts  # WebSocket 连接
│   │   ├── qr-onboarding.ts # QR 扫码注册
│   │   └── lark-auth.ts     # lark-cli 认证
│   ├── trigger/             # 触发器
│   │   ├── trigger.ts       # 触发文件
│   │   └── invoker.ts       # 调用 Claude CLI
│   └── config/              # 配置
│       └── env.ts           # 环境变量
├── workspace/
│   └── .claude/             # Claude Code 工作目录
│       ├── settings.json    # Claude 配置
│       ├── sessions/        # 会话文件
│       └── skills/          # Skills 目录
│           ├── chat/        # 对话 Skill
│           ├── lark-nav/    # Lark 导航
│           ├── lark-im/     # 即时通讯
│           └── ...          # 更多 Skills
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
4. **Service** - 启动后台服务

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
| 普通消息 | 与 Claude AI 对话 |

## Skills 列表

内置多个 Lark Skills：

| Skill | 描述 |
|-------|------|
| `chat` | 智能对话 |
| `lark-im` | 即时通讯 |
| `lark-doc` | 文档操作 |
| `lark-sheets` | 表格操作 |
| `lark-calendar` | 日历管理 |
| `lark-drive` | 云盘操作 |
| `lark-nav` | 技能导航 |
| `auto-repair` | 自动修复 |

## 开发命令

```bash
npm run cli          # 配置 CLI
npm start            # 启动服务
npm run start:prod   # PM2 后台运行
npm stop             # 停止服务
npm restart          # 重启服务
npm run logs         # 查看日志
npm run build        # 构建
npm test             # 测试
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
