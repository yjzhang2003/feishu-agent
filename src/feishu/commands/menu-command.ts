import type { CommandHandler, CommandContext } from './types.js';

export class MenuCommand implements CommandHandler {
  name = '/菜单';
  aliases = ['/menu'];
  description = '显示交互式菜单';

  async execute(ctx: CommandContext): Promise<void> {
    await ctx.sendMenuCard();
  }
}
