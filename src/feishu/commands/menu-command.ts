import type { CommandHandler, CommandContext } from './types.js';
import { createCallbackCard, type CallbackButton } from '../card-builder.js';

export class MenuCommand implements CommandHandler {
  name = '/菜单';
  description = '显示交互式菜单';

  async execute(ctx: CommandContext): Promise<void> {
    const buttons: CallbackButton[] = [
      { text: '🛠️ 自动修复', action: 'nav:repair', type: 'primary' },
      { text: '📋 服务管理', action: 'nav:service', type: 'default' },
      { text: '📊 系统状态', action: 'nav:status', type: 'default' },
      { text: '❓ 帮助', action: 'nav:help', type: 'default' },
    ];

    const card = createCallbackCard({
      title: '🤖 菜单',
      elements: [
        { tag: 'markdown', content: '**欢迎使用 oh-my-feishu！**\n\n选择一个操作：' },
        { tag: 'markdown', content: '' },
        { tag: 'markdown', content: '**🛠️ 自动修复** - 分析错误日志并自动修复' },
        { tag: 'markdown', content: '**📋 服务管理** - 管理 traceback 监控服务' },
        { tag: 'markdown', content: '**📊 系统状态** - 查看服务状态' },
        { tag: 'markdown', content: '**❓ 帮助** - 查看所有命令' },
        { tag: 'hr' },
        { tag: 'markdown', content: '💡 **提示**：点击上方按钮快速操作，或直接发送消息与 Claude Code 对话' },
        { tag: 'markdown', content: '' },
        { tag: 'markdown', content: '---' },
        { tag: 'markdown', content: '**📌 事件订阅（可选）**\n\n如果你的应用在[飞书开放平台](https://open.feishu.cn)开启了 `im.chat.access_event.bot_p2p_chat_entered_v1` 事件订阅，每次进入会话时菜单会自动打开。' },
      ],
      buttons,
    });

    await ctx.sendCard(card);
  }
}
