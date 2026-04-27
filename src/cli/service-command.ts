#!/usr/bin/env node
/**
 * Service registry CLI — manage registered services for traceback monitoring.
 *
 * Usage:
 *   feishu-agent service add <name> <owner/repo> <traceback_url> [--chat-id <id>]
 *   feishu-agent service remove <name>
 *   feishu-agent service list
 *   feishu-agent service enable <name>
 *   feishu-agent service disable <name>
 */

import { addService, removeService, listServices, updateService } from '../service/registry.js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

// Load .env
const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  config({ path: envPath });
}

function parseArgs(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && args[i + 1]) {
      flags[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return flags;
}

function printUsage(): void {
  console.log(`Usage:
  feishu-agent service add <name> <owner/repo> <traceback_url> [--chat-id <id>]
  feishu-agent service remove <name>
  feishu-agent service list
  feishu-agent service enable <name>
  feishu-agent service disable <name>`);
}

const [,, subCommand, ...args] = process.argv;

async function main(): Promise<void> {
  switch (subCommand) {
    case 'add': {
      const [name, repo, tracebackUrl] = args;
      const flags = parseArgs(args);

      if (!name || !repo || !tracebackUrl) {
        console.error('Error: Missing arguments.');
        printUsage();
        process.exit(1);
      }

      if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo)) {
        console.error(`Error: Invalid repo format "${repo}". Must be owner/repo.`);
        process.exit(1);
      }

      if (!/^https?:\/\/.+/.test(tracebackUrl)) {
        console.error(`Error: Invalid URL "${tracebackUrl}". Must start with http:// or https://`);
        process.exit(1);
      }

      const [githubOwner, githubRepo] = repo.split('/');
      const chatId = flags['chat-id'] || '';

      try {
        addService({
          name,
          githubOwner,
          githubRepo,
          tracebackUrl,
          notifyChatId: chatId,
          tracebackUrlType: 'json',
          enabled: true,
          addedAt: new Date().toISOString(),
          addedBy: 'cli',
        });
        console.log(`✅ Service "${name}" registered (${repo})`);
      } catch (error) {
        console.error(`❌ ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
      }
      break;
    }

    case 'remove': {
      const name = args[0];
      if (!name) {
        console.error('Error: Missing service name.');
        printUsage();
        process.exit(1);
      }

      const removed = removeService(name);
      if (removed) {
        console.log(`✅ Service "${name}" removed`);
      } else {
        console.error(`❌ Service "${name}" not found`);
        process.exit(1);
      }
      break;
    }

    case 'list': {
      const services = listServices();
      if (services.length === 0) {
        console.log('No services registered.');
        break;
      }

      console.log(`Registered services (${services.length}):\n`);
      for (const s of services) {
        const status = s.enabled ? '🟢' : '🔴';
        const last = s.lastCheckedAt ? `last checked: ${s.lastCheckedAt}` : 'never checked';
        console.log(`  ${status} ${s.name}`);
        console.log(`    repo: ${s.githubOwner}/${s.githubRepo}`);
        console.log(`    traceback: ${s.tracebackUrl}`);
        console.log(`    ${last}`);
        console.log();
      }
      break;
    }

    case 'enable':
    case 'disable': {
      const name = args[0];
      if (!name) {
        console.error('Error: Missing service name.');
        printUsage();
        process.exit(1);
      }

      const updated = updateService(name, { enabled: subCommand === 'enable' });
      if (updated) {
        console.log(`✅ Service "${name}" ${subCommand === 'enable' ? 'enabled' : 'disabled'}`);
      } else {
        console.error(`❌ Service "${name}" not found`);
        process.exit(1);
      }
      break;
    }

    default:
      printUsage();
      process.exit(subCommand ? 1 : 0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
