import { execa } from 'execa';
import { resolve } from 'path';
import { env } from '../config/env.js';
import { readFileSync, existsSync } from 'fs';

export interface InvokeOptions {
  skill: string;
  timeout?: number; // milliseconds
}

export interface InvokeResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ChatContext {
  message: string;
  chatId: string;
  senderOpenId: string;
  chatType: string;
}

// Read .env from workspace/.claude/.env and return as env vars object
function loadWorkspaceEnv(): Record<string, string> {
  const envPath = resolve(env.REPO_ROOT, 'workspace', '.claude', '.env');
  const vars: Record<string, string> = {};

  if (existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const match = line.match(/^(\w+)=(.+)$/);
        if (match) {
          vars[match[1]] = match[2].trim();
        }
      }
    } catch {
      // Ignore errors
    }
  }

  return vars;
}

/**
 * Invoke Claude Code CLI with a skill
 */
export async function invokeClaudeSkill(options: InvokeOptions): Promise<InvokeResult> {
  const { skill, timeout = 300000 } = options;
  const workspaceDir = resolve(env.REPO_ROOT, 'workspace');

  try {
    const workspaceEnv = loadWorkspaceEnv();
    const result = await execa('claude', [
      '-p',
      '--dangerously-skip-permissions',
      `/${skill}`,
    ], {
      cwd: workspaceDir,
      timeout,
      reject: false,
      env: { ...process.env, ...workspaceEnv },
    });

    return {
      success: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 1,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        stdout: '',
        stderr: error.message,
        exitCode: 1,
      };
    }
    return {
      success: false,
      stdout: '',
      stderr: 'Unknown error',
      exitCode: 1,
    };
  }
}

/**
 * Invoke Claude Code directly with a chat message
 * Claude has full access to lark-cli for responding
 */
export async function invokeClaudeChat(context: ChatContext, timeout: number = 300000): Promise<InvokeResult> {
  const workspaceDir = resolve(env.REPO_ROOT, 'workspace');

  const prompt = `You are a Feishu chat assistant. A user sent you a message.

Context:
- Chat ID: ${context.chatId}
- Chat Type: ${context.chatType}
- Sender Open ID: ${context.senderOpenId}
- Message: ${context.message}

You have full access to lark-cli to interact with Feishu. Use these commands as needed:

For messaging:
- lark-cli im send-text --chat-id <chat_id> "<message>"  - Send text to a chat
- lark-cli im send-card --chat-id <chat_id> '<card_json>' - Send interactive card

For user info:
- lark-cli contact user get --open-id <open_id> - Get user info

You can also use other tools available in this workspace.

Respond to the user's message appropriately. If they ask about code, analyze it.
If they ask about logs, check them. Be helpful and concise.

After processing, use lark-cli to send your response back to chat ID: ${context.chatId}`;

  try {
    const workspaceEnv = loadWorkspaceEnv();
    const result = await execa('claude', [
      '-p',
      '--dangerously-skip-permissions',
      prompt,
    ], {
      cwd: workspaceDir,
      timeout,
      reject: false,
      env: { ...process.env, ...workspaceEnv },
    });

    return {
      success: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 1,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        stdout: '',
        stderr: error.message,
        exitCode: 1,
      };
    }
    return {
      success: false,
      stdout: '',
      stderr: 'Unknown error',
      exitCode: 1,
    };
  }
}

/**
 * Check if Claude CLI is available
 */
export async function checkClaudeCli(): Promise<{ available: boolean; version?: string }> {
  try {
    const result = await execa('claude', ['--version']);
    const version = result.stdout.trim().split('\n')[0];
    return { available: true, version };
  } catch {
    return { available: false };
  }
}
