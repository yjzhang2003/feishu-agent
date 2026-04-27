import type { CommandHandler, CommandContext } from './types.js';
import { createCallbackCard, type CallbackButton } from '../card-builder.js';

export class MenuCommand implements CommandHandler {
  name = '/菜单';
  description = '显示交互式菜单';

  async execute(ctx: CommandContext): Promise<void> {
    const buttons: CallbackButton[] = [
      { text: '💬 直接对话', action: 'session:direct', type: 'primary' },
      { text: '📁 目录会话', action: 'session:directory', type: 'default' },
      { text: '🛠️ 自动修复', action: 'nav:repair', type: 'default' },
      { text: '📊 服务管理', action: 'nav:service', type: 'default' },
    ];

    const card = createCallbackCard({
      title: '🤖 菜单',
      elements: [
        { tag: 'markdown', content: '**📌 会话模式**' },
        { tag: 'markdown', content: '**💬 直接对话** - 在当前会话直接与 Claude 对话' },
        { tag: 'markdown', content: '**📁 目录会话** - 在指定项目目录启动 Claude 进程' },
        { tag: 'hr' },
        { tag: 'markdown', content: '**📋 功能菜单**' },
        { tag: 'markdown', content: '**🛠️ 自动修复** - 分析错误日志并自动修复' },
        { tag: 'markdown', content: '**📊 服务管理** - 管理 traceback 监控服务' },
        { tag: 'hr' },
        { tag: 'markdown', content: '💡 点击按钮快速操作，或直接发送消息与 Claude Code 对话' },
      ],
      buttons,
    });

    await ctx.sendCard(card);
  }
}
