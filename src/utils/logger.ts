import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { env } from '../config/env.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface LoggerConfig {
  level: LogLevel;
  logDir: string;
  enableFile: boolean;
  enableConsole: boolean;
}

const defaultConfig: LoggerConfig = {
  level: (process.env.LOG_LEVEL as LogLevel) || 'info',
  logDir: resolve(env.REPO_ROOT, 'logs'),
  enableFile: process.env.LOG_FILE !== 'false',
  enableConsole: process.env.LOG_CONSOLE !== 'false',
};

class Logger {
  private config: LoggerConfig;
  private messageLogPath: string;
  private systemLogPath: string;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.messageLogPath = resolve(this.config.logDir, 'messages.log');
    this.systemLogPath = resolve(this.config.logDir, 'system.log');

    if (this.config.enableFile && !existsSync(this.config.logDir)) {
      mkdirSync(this.config.logDir, { recursive: true });
    }
  }

  private formatEntry(entry: LogEntry): string {
    const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
    return `[${entry.timestamp}] [${entry.level.toUpperCase().padEnd(5)}] [${entry.category}] ${entry.message}${dataStr}\n`;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private write(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    const formatted = this.formatEntry(entry);

    if (this.config.enableConsole) {
      const prefix = this.getConsolePrefix(entry.level);
      if (entry.data) {
        console.log(`${prefix}[${entry.category}] ${entry.message}`, entry.data);
      } else {
        console.log(`${prefix}[${entry.category}] ${entry.message}`);
      }
    }

    if (this.config.enableFile) {
      const logPath = entry.category === 'message' ? this.messageLogPath : this.systemLogPath;
      try {
        appendFileSync(logPath, formatted);
      } catch {
        // Silently fail if file write fails
      }
    }
  }

  private getConsolePrefix(level: LogLevel): string {
    switch (level) {
      case 'error': return '\x1b[31m❌ \x1b[0m';
      case 'warn': return '\x1b[33m⚠️  \x1b[0m';
      case 'info': return '\x1b[36mℹ️  \x1b[0m';
      case 'debug': return '\x1b[90m🔍 \x1b[0m';
    }
  }

  log(level: LogLevel, category: string, message: string, data?: Record<string, unknown>): void {
    this.write({
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
    });
  }

  debug(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('debug', category, message, data);
  }

  info(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('info', category, message, data);
  }

  warn(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('warn', category, message, data);
  }

  error(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('error', category, message, data);
  }

  /**
   * Log a message received from Feishu
   */
  messageIn(chatId: string, senderId: string, content: string, msgType: string = 'text'): void {
    this.log('info', 'message', '📥 IN', {
      direction: 'in',
      chatId,
      senderId,
      msgType,
      content: content.slice(0, 500), // Truncate long content
    });
  }

  /**
   * Log a message sent to Feishu
   */
  messageOut(chatId: string, content: string, msgType: string = 'text'): void {
    this.log('info', 'message', '📤 OUT', {
      direction: 'out',
      chatId,
      msgType,
      content: content.slice(0, 500),
    });
  }

  /**
   * Log a command execution
   */
  command(chatId: string, command: string, args?: string): void {
    this.log('info', 'command', `⚡ ${command}`, {
      chatId,
      command,
      args,
    });
  }

  /**
   * Log skill invocation
   */
  skill(skillName: string, action: 'start' | 'success' | 'error', data?: Record<string, unknown>): void {
    const emoji = action === 'start' ? '🚀' : action === 'success' ? '✅' : '❌';
    this.log(action === 'error' ? 'error' : 'info', 'skill', `${emoji} ${skillName}`, data);
  }
}

// Singleton instance
export const logger = new Logger();

// Convenience functions
export const log = {
  debug: (category: string, message: string, data?: Record<string, unknown>) => logger.debug(category, message, data),
  info: (category: string, message: string, data?: Record<string, unknown>) => logger.info(category, message, data),
  warn: (category: string, message: string, data?: Record<string, unknown>) => logger.warn(category, message, data),
  error: (category: string, message: string, data?: Record<string, unknown>) => logger.error(category, message, data),
  messageIn: (chatId: string, senderId: string, content: string, msgType?: string) => logger.messageIn(chatId, senderId, content, msgType),
  messageOut: (chatId: string, content: string, msgType?: string) => logger.messageOut(chatId, content, msgType),
  command: (chatId: string, command: string, args?: string) => logger.command(chatId, command, args),
  skill: (skillName: string, action: 'start' | 'success' | 'error', data?: Record<string, unknown>) => logger.skill(skillName, action, data),
};
