/**
 * Session Manager
 * Manages all Gateway sessions (direct and directory)
 */

import { createHash } from 'crypto';
import { log } from '../utils/logger.js';
import { ClaudeProcessManager } from './claude-process-manager.js';
import { UnixSocketBridge, type MessageHandler } from './ipc/unix-socket-bridge.js';
import type { Session, SessionMessage, SessionInfo } from './types.js';
import type { Socket } from 'net';

export class SessionManager {
  private sessions = new Map<string, Session>();
  private processManager: ClaudeProcessManager;
  private socketBridge: UnixSocketBridge;
  private messageHandlers: Map<string, (message: string) => void> = new Map();

  constructor() {
    this.processManager = new ClaudeProcessManager();
    this.socketBridge = new UnixSocketBridge();
  }

  private chatIdToSessionId(chatId: string): string {
    const hash = createHash('sha256').update(chatId).digest('hex');
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(12, 15)}-${(parseInt(hash.slice(15, 16), 16) & 0x3 | 0x8).toString(16)}${hash.slice(16, 19)}-${hash.slice(19, 31)}`;
  }

  async start(): Promise<void> {
    const handler: MessageHandler = (message, socket) => {
      this.handleIpcMessage(message, socket);
    };
    await this.socketBridge.start(handler);
    log.info('session-manager', 'Session manager started');
  }

  async stop(): Promise<void> {
    this.processManager.stopAll();
    await this.socketBridge.stop();
    this.sessions.clear();
    log.info('session-manager', 'Session manager stopped');
  }

  private handleIpcMessage(message: SessionMessage, socket: Socket): void {
    switch (message.type) {
      case 'create':
        this.handleCreateSession(message, socket);
        break;
      case 'destroy':
        this.handleDestroySession(message);
        break;
      case 'message':
        this.handleChatMessage(message);
        break;
      case 'list':
        this.handleListSessions(socket);
        break;
    }
  }

  private handleCreateSession(message: SessionMessage, socket: Socket): void {
    if (!message.chatId || !message.directory) {
      log.error('session-manager', 'Missing chatId or directory for create session');
      return;
    }

    const chatId = message.chatId;
    const directory = message.directory;
    const sessionId = this.chatIdToSessionId(chatId);
    const session: Session = {
      id: sessionId,
      type: 'directory',
      chatId,
      directory,
      createdAt: new Date(),
    };

    this.sessions.set(chatId, session);

    // Start Claude Code process for this directory session
    this.processManager.start({
      directory,
      chatId,
      senderOpenId: message.senderOpenId || '',
      onMessage: (msg) => {
        // Forward Claude's output back to IPC
        this.socketBridge.send(socket, {
          type: 'message',
          sessionId,
          chatId,
          content: msg,
        });
      },
      onExit: (code) => {
        log.info('session-manager', 'Claude process exited', { chatId, code });
        this.sessions.delete(chatId);
      },
    });

    log.info('session-manager', 'Directory session created', { chatId, directory });
  }

  private handleDestroySession(message: SessionMessage): void {
    if (!message.chatId) return;

    this.processManager.stop(message.chatId);
    this.sessions.delete(message.chatId);
    log.info('session-manager', 'Session destroyed', { chatId: message.chatId });
  }

  private handleChatMessage(message: SessionMessage): void {
    if (!message.chatId || !message.content) return;

    const session = this.sessions.get(message.chatId);
    if (!session) {
      log.warn('session-manager', 'No session found for chatId', { chatId: message.chatId });
      return;
    }

    if (session.type === 'directory') {
      this.processManager.sendMessage(message.chatId, message.content);
    }
  }

  private handleListSessions(socket: Socket): void {
    const sessions: SessionInfo[] = Array.from(this.sessions.values()).map((s) => ({
      id: s.id,
      type: s.type,
      chatId: s.chatId,
      directory: s.directory,
      createdAt: s.createdAt.toISOString(),
    }));

    this.socketBridge.send(socket, {
      type: 'list',
      content: JSON.stringify(sessions),
    });
  }

  // For gateway-direct sessions, we don't need process management
  // Messages go directly to the existing invokeClaudeChat flow
  registerGatewayDirect(chatId: string): Session {
    const sessionId = this.chatIdToSessionId(chatId);
    const session: Session = {
      id: sessionId,
      type: 'gateway-direct',
      chatId,
      createdAt: new Date(),
    };
    this.sessions.set(chatId, session);
    return session;
  }

  getSession(chatId: string): Session | undefined {
    return this.sessions.get(chatId);
  }

  getSocketPath(): string {
    return this.socketBridge.getSocketPath();
  }
}
