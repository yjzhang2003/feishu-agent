import * as lark from '@larksuiteoapi/node-sdk';
import { writeTrigger } from '../trigger/trigger.js';
import { invokeClaudeSkill } from '../trigger/invoker.js';
import { env } from '../config/env.js';
import { log } from '../utils/logger.js';

export interface FeishuWebSocketConfig {
  appId: string;
  appSecret: string;
  domain?: lark.Domain;
}

export class FeishuWebSocket {
  private client: lark.Client;
  private wsClient: lark.WSClient | null = null;
  private config: FeishuWebSocketConfig;
  private connected = false;

  constructor(config: FeishuWebSocketConfig) {
    this.config = config;
    this.client = new lark.Client({
      appId: config.appId,
      appSecret: config.appSecret,
      domain: config.domain || lark.Domain.Feishu,
    });
  }

  async connect(): Promise<void> {
    const eventDispatcher = new lark.EventDispatcher({}).register({
      'im.message.receive_v1': async (data) => {
        await this.handleMessage(data);
      },
    });

    this.wsClient = new lark.WSClient({
      appId: this.config.appId,
      appSecret: this.config.appSecret,
      domain: this.config.domain || lark.Domain.Feishu,
      loggerLevel: lark.LoggerLevel.info,
    });

    await this.wsClient.start({
      eventDispatcher,
    });

    this.connected = true;
    log.info('feishu', 'WebSocket connected');
  }

  async disconnect(): Promise<void> {
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
      this.connected = false;
      log.info('feishu', 'WebSocket disconnected');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getClient(): lark.Client {
    return this.client;
  }

  private async handleMessage(data: {
    sender: { sender_id?: { open_id?: string }; sender_type: string };
    message: { message_id: string; chat_id: string; content: string; chat_type: string; message_type?: string };
  }): Promise<void> {
    try {
      const { message, sender } = data;

      // Skip bot messages
      if (sender.sender_type === 'bot') {
        return;
      }

      // Parse message content
      let text = '';
      let msgType = message.message_type || 'text';
      try {
        const content = JSON.parse(message.content);
        text = content.text || '';
      } catch {
        text = message.content;
      }

      const chatId = message.chat_id;
      const senderOpenId = sender.sender_id?.open_id || '';

      if (!senderOpenId) {
        log.warn('feishu', 'Message without sender_id, skipping');
        return;
      }

      // Log incoming message
      log.messageIn(chatId, senderOpenId, text, msgType);

      // Handle commands
      if (text.startsWith('/repair') || text.startsWith('/fix')) {
        await this.handleRepairCommand(chatId, text, senderOpenId);
        return;
      }

      if (text.startsWith('/status')) {
        log.command(chatId, '/status');
        await this.handleStatusCommand(chatId);
        return;
      }

      if (text.startsWith('/help')) {
        log.command(chatId, '/help');
        await this.handleHelpCommand(chatId);
        return;
      }

      // Regular message - trigger chat skill
      await this.handleChatMessage(chatId, text, senderOpenId);
    } catch (error) {
      log.error('feishu', 'Error handling message', { error: String(error) });
    }
  }

  private async handleRepairCommand(chatId: string, text: string, senderOpenId: string): Promise<void> {
    const context = text.replace(/^\/(repair|fix)\s*/, '').trim() || 'Repair requested';
    log.command(chatId, '/repair', context);

    // Send acknowledgment
    await this.sendCardMessage(chatId, {
      title: '🔄 Auto Repair Started',
      elements: [
        `**Context:** ${context}`,
        'Analyzing the issue...',
      ],
    });

    // Write trigger
    writeTrigger({
      context,
      source: 'feishu',
      timestamp: new Date().toISOString(),
      metadata: {
        chat_id: chatId,
        sender_open_id: senderOpenId,
      },
    });

    // Invoke skill asynchronously
    log.skill('auto-repair', 'start', { chatId, context });
    invokeClaudeSkill({ skill: 'auto-repair' })
      .then(async (result) => {
        if (result.success) {
          log.skill('auto-repair', 'success', { chatId });
          await this.sendCardMessage(chatId, {
            title: '✅ Repair Complete',
            elements: ['The repair has been completed successfully.'],
          });
        } else {
          log.skill('auto-repair', 'error', { chatId, error: result.stderr });
          await this.sendCardMessage(chatId, {
            title: '❌ Repair Failed',
            elements: [`\`\`\`\n${result.stderr || 'Unknown error'}\n\`\`\``],
          });
        }
      })
      .catch((error) => {
        log.error('feishu', 'Repair command failed', { error: String(error) });
      });
  }

  private async handleStatusCommand(chatId: string): Promise<void> {
    const { checkClaudeCli } = await import('../trigger/invoker.js');
    const claudeStatus = await checkClaudeCli();

    const statusText = `📊 System Status

**Claude CLI:** ${claudeStatus.available ? `✅ ${claudeStatus.version}` : '❌ Not available'}
**WebSocket:** ${this.connected ? '✅ Connected' : '❌ Disconnected'}
**GitHub:** ${env.GITHUB_TOKEN ? '✅ Configured' : '❌ Not configured'}`;

    await this.sendTextMessage(chatId, statusText);
  }

  private async handleHelpCommand(chatId: string): Promise<void> {
    await this.sendTextMessage(chatId, `🤖 Feishu Agent Commands

/repair [context] - Start auto-repair with optional context
/status - Check system status
/help - Show this help message

Or just send a message to chat with Claude Code!`);
  }

  private async handleChatMessage(chatId: string, text: string, senderOpenId: string): Promise<void> {
    // Send typing indicator
    await this.sendTextMessage(chatId, '🤔 Thinking...');

    // Write trigger for chat skill
    writeTrigger({
      context: text,
      source: 'feishu-chat',
      timestamp: new Date().toISOString(),
      metadata: {
        chat_id: chatId,
        sender_open_id: senderOpenId,
        message: text,
      },
    });

    // Invoke chat skill
    log.skill('chat', 'start', { chatId });
    invokeClaudeSkill({ skill: 'chat' })
      .then(async (result) => {
        if (result.success) {
          log.skill('chat', 'success', { chatId });
        } else {
          log.skill('chat', 'error', { chatId, error: result.stderr });
          await this.sendTextMessage(chatId, `❌ Error: ${result.stderr || 'Unknown error'}`);
        }
      })
      .catch(async (err) => {
        log.error('chat', 'Skill failed', { error: String(err) });
        await this.sendTextMessage(chatId, '❌ Failed to process your message. Please try again.');
      });
  }

  async sendTextMessage(chatId: string, text: string): Promise<void> {
    try {
      await this.client.im.v1.message.create({
        params: {
          receive_id_type: 'chat_id',
        },
        data: {
          receive_id: chatId,
          content: JSON.stringify({ text }),
          msg_type: 'text',
        },
      });
      log.messageOut(chatId, text, 'text');
    } catch (error) {
      log.error('feishu', 'Error sending text message', { chatId, error: String(error) });
    }
  }

  async sendCardMessage(chatId: string, card: { title: string; elements: string[] }): Promise<void> {
    try {
      const content = lark.messageCard.defaultCard({
        title: card.title,
        content: card.elements.join('\n\n'),
      });

      await this.client.im.v1.message.create({
        params: {
          receive_id_type: 'chat_id',
        },
        data: {
          receive_id: chatId,
          content,
          msg_type: 'interactive',
        },
      });
      log.messageOut(chatId, `[Card] ${card.title}`, 'interactive');
    } catch (error) {
      log.error('feishu', 'Error sending card message', { chatId, error: String(error) });
    }
  }
}

/**
 * Load lark-cli configuration
 */
export async function loadLarkCliConfig(): Promise<FeishuWebSocketConfig | null> {
  const os = await import('os');
  const path = await import('path');
  const fs = await import('fs');

  const configPath = path.join(os.homedir(), '.lark-cli', 'config.json');

  if (!fs.existsSync(configPath)) {
    log.error('feishu', 'lark-cli config not found', { path: configPath });
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);

    if (!config.appId || !config.appSecret) {
      log.error('feishu', 'Invalid lark-cli config: missing appId or appSecret');
      return null;
    }

    log.debug('feishu', 'Loaded lark-cli config', { appId: config.appId.slice(0, 8) + '...' });
    return {
      appId: config.appId,
      appSecret: config.appSecret,
    };
  } catch (error) {
    log.error('feishu', 'Failed to parse lark-cli config', { error: String(error) });
    return null;
  }
}
