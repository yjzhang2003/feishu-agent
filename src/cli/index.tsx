#!/usr/bin/env node
import React, { useState, useEffect } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import { getAllStatuses, ComponentStatus } from './hooks/useStatus.js';
import {
  getClaudeApiKey,
  setClaudeApiKey,
  resetClaudeApiKey,
  getEccPluginStatus,
  setFeishuCredentials,
  resetFeishuCredentials,
} from '../config/settings.js';
import { execa } from 'execa';
import { input, confirm } from '@inquirer/prompts';

// Main App - Status lines are selectable
function App() {
  const { exit } = useApp();
  const [statuses, setStatuses] = useState<Record<string, ComponentStatus>>(getAllStatuses());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [message, setMessage] = useState<string>('');
  const [isConfiguring, setIsConfiguring] = useState(false);

  const components = ['claude', 'feishu', 'github', 'ecc'] as const;
  const componentNames = ['Claude Code', 'Feishu', 'GitHub', 'ECC'];

  const refreshStatuses = () => {
    setStatuses(getAllStatuses());
  };

  // Keyboard navigation
  useInput((input, key) => {
    if (isConfiguring) return;

    if (key.upArrow || input === 'k') {
      setSelectedIndex((prev) => (prev - 1 + components.length) % components.length);
    } else if (key.downArrow || input === 'j') {
      setSelectedIndex((prev) => (prev + 1) % components.length);
    } else if (key.return) {
      handleConfigure(components[selectedIndex]);
    } else if (key.escape || input === 'q') {
      exit();
    }
  });

  const handleConfigure = async (component: typeof components[number]) => {
    setIsConfiguring(true);
    console.log('\n');

    try {
      if (component === 'claude') {
        await handleClaudeConfig();
      } else if (component === 'feishu') {
        await handleFeishuConfig();
      } else if (component === 'github') {
        await handleGitHubConfig();
      } else if (component === 'ecc') {
        await handleEccConfig();
      }

      refreshStatuses();
    } catch (error) {
      setMessage(`Error: ${error}`);
    }

    setIsConfiguring(false);
  };

  const handleClaudeConfig = async () => {
    const currentKey = getClaudeApiKey();

    if (currentKey) {
      const action = await input({
        message: 'Action: [r]econfigure, [x]reset, [c]ancel',
        default: 'c',
      });

      if (action === 'r') {
        const newKey = await input({ message: 'Enter new ANTHROPIC_API_KEY' });
        if (newKey) {
          setClaudeApiKey(newKey);
          setMessage('✓ API key updated');
        }
      } else if (action === 'x') {
        const confirmed = await confirm({ message: 'Reset API key?', default: false });
        if (confirmed) {
          resetClaudeApiKey();
          setMessage('✓ API key removed');
        }
      }
    } else {
      const apiKey = await input({ message: 'Enter your ANTHROPIC_API_KEY' });
      if (apiKey) {
        setClaudeApiKey(apiKey);
        setMessage('✓ API key saved to ~/.claude/settings.json');
      }
    }
  };

  const handleFeishuConfig = async () => {
    const status = statuses.feishu;

    if (status.configured) {
      const action = await input({
        message: 'Action: [r]econfigure, [x]reset, [c]ancel',
        default: 'c',
      });

      if (action === 'r') {
        const appId = await input({ message: 'FEISHU_APP_ID' });
        if (appId) {
          const appSecret = await input({ message: 'FEISHU_APP_SECRET' });
          if (appSecret) {
            setFeishuCredentials(appId, appSecret);
            setMessage('✓ Feishu credentials saved');
          }
        }
      } else if (action === 'x') {
        const confirmed = await confirm({ message: 'Reset Feishu credentials?', default: false });
        if (confirmed) {
          resetFeishuCredentials();
          setMessage('✓ Feishu credentials removed');
        }
      }
    } else {
      console.log('\nTip: Scan QR with "feishu-agent setup" to auto-create a bot\n');
      const appId = await input({ message: 'FEISHU_APP_ID' });
      if (appId) {
        const appSecret = await input({ message: 'FEISHU_APP_SECRET' });
        if (appSecret) {
          setFeishuCredentials(appId, appSecret);
          setMessage('✓ Feishu credentials saved to .env');
        }
      }
    }
  };

  const handleGitHubConfig = async () => {
    const status = statuses.github;

    if (status.configured) {
      const action = await input({
        message: 'Action: [x]logout, [c]ancel',
        default: 'c',
      });

      if (action === 'x') {
        const confirmed = await confirm({ message: 'Logout from GitHub?', default: false });
        if (confirmed) {
          try {
            await execa('gh', ['auth', 'logout', '--hostname', 'github.com']);
            setMessage('✓ Logged out from GitHub');
          } catch {
            setMessage('✗ Failed to logout');
          }
        }
      }
    } else {
      console.log('\nThis will open a browser for GitHub OAuth login...\n');
      const confirmed = await confirm({ message: 'Continue?', default: true });
      if (confirmed) {
        try {
          await execa('gh', ['auth', 'login', '--git-protocol', 'https', '--web'], {
            stdio: 'inherit',
          });
          setMessage('✓ GitHub authenticated');
        } catch {
          setMessage('✗ Failed to authenticate');
        }
      }
    }
  };

  const handleEccConfig = async () => {
    const status = getEccPluginStatus();

    if (status.installed) {
      const action = await input({
        message: 'Action: [u]pdate, [c]ancel',
        default: 'c',
      });

      if (action === 'u') {
        try {
          await execa('claude', ['plugins', 'update', 'everything-claude-code@everything-claude-code']);
          setMessage('✓ ECC plugin updated');
        } catch {
          setMessage('✗ Failed to update ECC plugin');
        }
      }
    } else {
      console.log('\nECC (Everything Claude Code) provides enhanced skills and agents.\n');
      const confirmed = await confirm({ message: 'Install ECC plugin?', default: true });
      if (confirmed) {
        try {
          await execa('claude', ['plugins', 'install', 'everything-claude-code@everything-claude-code']);
          setMessage('✓ ECC plugin installed');
        } catch {
          setMessage('✗ Failed to install ECC plugin');
        }
      }
    }
  };

  if (isConfiguring) {
    return (
      <Box flexDirection="column">
        <Text dimColor>Configuring...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Feishu Agent Setup</Text>
      <Text dimColor>{"=".repeat(30)}</Text>
      <Text dimColor>↑↓ navigate | Enter configure | ESC quit</Text>
      <Text> </Text>

      {components.map((key, index) => {
        const status = statuses[key];
        const isSelected = index === selectedIndex;

        return (
          <Box key={key}>
            <Text color={isSelected ? 'cyan' : 'white'}>
              {isSelected ? '❯ ' : '  '}
            </Text>
            <Text color={status.configured ? 'green' : 'red'}>
              {status.configured ? '✓' : '✗'}
            </Text>
            <Text bold={isSelected}> {componentNames[index]}: </Text>
            <Text dimColor>{status.message}</Text>
          </Box>
        );
      })}

      {message && (
        <Box marginTop={1}>
          <Text color="green">{message}</Text>
        </Box>
      )}
    </Box>
  );
}

// Run the app
render(<App />);
