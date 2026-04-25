import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

// Project-level .claude directory in workspace/
const PROJECT_CLAUDE_DIR = resolve(process.cwd(), 'workspace', '.claude');
const PROJECT_ENV_PATH = resolve(PROJECT_CLAUDE_DIR, '.env');

// Ensure .claude directory exists
function ensureClaudeDir(): void {
  if (!existsSync(PROJECT_CLAUDE_DIR)) {
    mkdirSync(PROJECT_CLAUDE_DIR, { recursive: true });
  }
}

// .env file management in .claude directory
function updateEnvFile(key: string, value: string): void {
  ensureClaudeDir();

  let content = '';
  if (existsSync(PROJECT_ENV_PATH)) {
    content = readFileSync(PROJECT_ENV_PATH, 'utf-8');
  }

  const lines = content.split('\n');
  let found = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(`${key}=`)) {
      lines[i] = `${key}=${value}`;
      found = true;
      break;
    }
  }

  if (!found) {
    lines.push(`${key}=${value}`);
  }

  writeFileSync(PROJECT_ENV_PATH, lines.join('\n'));
}

function removeFromEnvFile(key: string): void {
  if (!existsSync(PROJECT_ENV_PATH)) {
    return;
  }

  const content = readFileSync(PROJECT_ENV_PATH, 'utf-8');
  const lines = content.split('\n').filter(line => !line.startsWith(`${key}=`));

  writeFileSync(PROJECT_ENV_PATH, lines.join('\n'));
}

// Feishu credentials
export function setFeishuCredentials(appId: string, appSecret: string): void {
  updateEnvFile('FEISHU_APP_ID', appId);
  updateEnvFile('FEISHU_APP_SECRET', appSecret);
}

export function resetFeishuCredentials(): void {
  removeFromEnvFile('FEISHU_APP_ID');
  removeFromEnvFile('FEISHU_APP_SECRET');
}
