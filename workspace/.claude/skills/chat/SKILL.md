---
name: chat
description: "向用户发送消息和卡片。通过 lark-cli 将文本、Markdown 或卡片消息发送到飞书聊天。"
---

# Chat Skill — 向用户发送消息

## CRITICAL: 必须使用 lark-cli 回复

当需要向用户发送消息时，你**必须**通过 lark-cli 发送，不能只输出文本到 stdout。
- **不要**在回复中重复用户的原始消息
- **不要**说"用户消息: xxx" 或 "你问的是: xxx"

## Context

从环境变量获取上下文：
- `FEISHU_CHAT_ID`: 当前聊天 ID
- `FEISHU_SENDER_OPEN_ID`: 发送者 Open ID
- `FEISHU_MESSAGE_ID`: 触发消息 ID（可用于回复线程）

## 发送方式

### 发送 Markdown 消息（推荐）

**必须**使用 `--type markdown` 参数，否则列表和格式不会正确渲染：

```bash
lark-cli im +messages-send --chat-id "$FEISHU_CHAT_ID" --type markdown --text "你的回复"
```

### 回复消息（支持 Thread）

```bash
lark-cli im +messages-reply --message-id "$FEISHU_MESSAGE_ID" --text "回复内容" --type markdown
```

### 发送卡片消息

```bash
lark-cli im +messages-send --chat-id "$FEISHU_CHAT_ID" --data '{
  "type": "interactive",
  "card": {
    "header": {"title": {"content": "标题", "tag": "plain_text"}},
    "elements": [{"tag": "markdown", "content": "内容"}]
  }
}'
```

### Markdown 支持的格式

- **粗体**: `**文本**`
- *斜体*: `*文本*`
- 列表: `- 项目` 或 `1. 项目`
- 代码: `` `代码` `` 或 ` ```代码块``` `
- 链接: `[文字](URL)`

## 流程

1. 理解用户消息意图
2. 按用户需求完成任务
3. 组织回复内容，并**使用 lark-cli 发送回复**（带上 `--type markdown`）
