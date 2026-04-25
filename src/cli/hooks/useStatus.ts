import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';

export interface ComponentStatus {
  name: string;
  configured: boolean;
  message: string;
}

const CHECK_TIMEOUT_MS = 3000;

// Helper to run command with timeout
function runCommand(cmd: string, timeoutMs: number = CHECK_TIMEOUT_MS): { stdout: string; stderr: string; success: boolean } | null {
  try {
    const result = execSync(cmd, {
      encoding: 'utf-8',
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { stdout: result, stderr: '', success: true };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; status?: number };
    // Return output even on failure (gh auth status writes to stderr on success)
    if (execError.stdout || execError.stderr) {
      return {
        stdout: execError.stdout || '',
        stderr: execError.stderr || '',
        success: false
      };
    }
    return null;
  }
}

// Claude Code CLI status
export function checkClaudeCode(): ComponentStatus {
  const result = runCommand('claude --version');

  if (!result) {
    return { name: 'Claude Code', configured: false, message: 'CLI not installed' };
  }

  const version = result.stdout.trim().split('\n')[0];

  // Check for API key
  const settingsPath = resolve(homedir(), '.claude', 'settings.json');
  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      const hasKey = settings.env?.ANTHROPIC_API_KEY || settings.env?.ANTHROPIC_AUTH_TOKEN;
      if (hasKey) {
        return { name: 'Claude Code', configured: true, message: `${version} - API configured` };
      }
    } catch {
      // Ignore parse errors
    }
  }

  return { name: 'Claude Code', configured: false, message: 'API key not configured' };
}

// Feishu status - file read is fast, no timeout needed
export function checkFeishu(): ComponentStatus {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    return { name: 'Feishu', configured: false, message: 'No .env file' };
  }

  try {
    const content = readFileSync(envPath, 'utf-8');
    const hasAppId = /FEISHU_APP_ID=.+/.test(content);
    const hasSecret = /FEISHU_APP_SECRET=.+/.test(content);

    if (hasAppId && hasSecret) {
      // Extract app_id for display
      const match = content.match(/FEISHU_APP_ID=(.+)/);
      const appId = match ? match[1].trim() : '';
      return { name: 'Feishu', configured: true, message: `Bot: ${appId.slice(0, 8)}...` };
    }

    return { name: 'Feishu', configured: false, message: 'Bot credentials not configured' };
  } catch {
    return { name: 'Feishu', configured: false, message: 'Cannot read .env' };
  }
}

// GitHub status
export function checkGitHub(): ComponentStatus {
  const result = runCommand('gh auth status');

  if (!result) {
    return { name: 'GitHub', configured: false, message: 'Not authenticated' };
  }

  // gh auth status outputs to both stdout and stderr
  const output = result.stdout + result.stderr;

  // Extract username - match "Logged in to github.com account xxx" format
  const match = output.match(/Logged in to github\.com account (\S+)/);
  if (match) {
    return { name: 'GitHub', configured: true, message: `Authenticated as ${match[1]}` };
  }

  return { name: 'GitHub', configured: false, message: 'Not authenticated' };
}

// ECC plugin status - file read is fast, no timeout needed
export function checkECC(): ComponentStatus {
  const pluginsPath = resolve(homedir(), '.claude', 'plugins', 'installed_plugins.json');

  if (!existsSync(pluginsPath)) {
    return { name: 'ECC', configured: false, message: 'Plugin not installed' };
  }

  try {
    const content = readFileSync(pluginsPath, 'utf-8');
    const plugins = JSON.parse(content).plugins || {};

    const eccId = 'everything-claude-code@everything-claude-code';
    if (plugins[eccId] && plugins[eccId][0]) {
      const version = plugins[eccId][0].version;
      return { name: 'ECC', configured: true, message: `Plugin v${version} installed` };
    }

    return { name: 'ECC', configured: false, message: 'Plugin not installed' };
  } catch {
    return { name: 'ECC', configured: false, message: 'Plugin not installed' };
  }
}

// Get all statuses (parallel execution)
export function getAllStatuses(): Record<string, ComponentStatus> {
  // Run slow checks in parallel
  const [claude, github] = [
    checkClaudeCode(),
    checkGitHub(),
  ];

  // Fast file reads
  const feishu = checkFeishu();
  const ecc = checkECC();

  return { claude, feishu, github, ecc };
}
