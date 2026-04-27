/**
 * Session add multi-step interaction flow
 * Handles creating directory sessions via Feishu UI
 */

import { SessionStore } from '../session-store.js';
import { log } from '../../../utils/logger.js';
import { createCallbackCard, md } from '../../card-builder.js';

export interface SendCardFn {
  (chatId: string, card: object): Promise<void>;
}

export class SessionAddFlow {
  constructor(
    private sessionStore: SessionStore,
    private sendCard: SendCardFn
  ) {}

  async start(chatId: string, senderOpenId: string): Promise<void> {
    log.info('flow', 'SessionAddFlow started', { chatId });
    this.sessionStore.set(chatId, {
      flow: 'session-add-step1',
      data: { addedBy: senderOpenId },
    });
    await this.sendCard(chatId, this.createDirectoryInputCard());
  }

  async handleInput(chatId: string, text: string): Promise<{ sessionCreated: boolean; error?: string }> {
    const session = this.sessionStore.get(chatId);

    if (session.flow === 'session-add-step1') {
      return this.handleDirectoryInput(chatId, text);
    }

    return { sessionCreated: false };
  }

  cancel(chatId: string): void {
    log.info('flow', 'SessionAddFlow cancelled', { chatId });
    this.sessionStore.set(chatId, { flow: 'none', mode: 'direct' });
  }

  private async handleDirectoryInput(chatId: string, directory: string): Promise<{ sessionCreated: boolean; error?: string }> {
    const trimmedDir = directory.trim();

    if (!trimmedDir) {
      await this.sendCard(chatId, this.createErrorCard('目录路径不能为空'));
      return { sessionCreated: false };
    }

    // Basic validation: must be an absolute path or start with ./ or ../
    if (!trimmedDir.startsWith('/') && !trimmedDir.startsWith('./') && !trimmedDir.startsWith('../')) {
      await this.sendCard(chatId, this.createErrorCard('请输入有效的目录路径（如 /home/user/project 或 ./my-project）'));
      return { sessionCreated: false };
    }

    // Return success - actual session creation will be done by the caller
    // The caller (MessageRouter) will call sessionManager to create the session
    this.sessionStore.set(chatId, {
      flow: 'none',
      mode: 'directory',
      data: { directory: trimmedDir },
    });

    return { sessionCreated: true, error: undefined };
  }

  private createDirectoryInputCard() {
    return createCallbackCard({
      title: '📁 创建目录会话',
      elements: [
        md('**请输入要打开的目录路径**'),
        md(''),
        md('输入格式：'),
        md('- 绝对路径：`/home/user/my-project`'),
        md('- 相对路径：`./my-project` 或 `../parent/project`'),
        md(''),
        md('*Claude 将在指定目录中启动，可以访问项目代码和文件*'),
      ],
      buttons: [
        { text: '◀️ 取消', action: 'session:add-cancel', type: 'danger' },
      ],
      headerColor: 'purple',
    });
  }

  private createErrorCard(message: string) {
    return createCallbackCard({
      title: '❌ 输入无效',
      elements: [
        md(`**错误：** ${message}`),
        md(''),
        md('请重新输入有效的目录路径'),
      ],
      buttons: [
        { text: '◀️ 取消', action: 'session:add-cancel', type: 'danger' },
      ],
      headerColor: 'red',
    });
  }

  private createSuccessCard(directory: string) {
    return createCallbackCard({
      title: '✅ 目录会话已创建',
      elements: [
        md(`**目录：** \`${directory}\``),
        md(''),
        md('Claude 进程已在指定目录中启动，可以开始对话了！'),
        md(''),
        md('💡 发送消息与 Claude 对话'),
      ],
      headerColor: 'green',
    });
  }
}
