#!/usr/bin/env node
import React, { useState, useEffect, useCallback } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import chalk from 'chalk';
import { SelectList } from './components/SelectList.js';
import { getAllStatuses, ComponentStatus } from './hooks/useStatus.js';
import {
  getClaudeApiKey,
  setClaudeApiKey,
  resetClaudeApiKey,
  getEccPluginStatus,
  setFeishuCredentials,
  resetFeishuCredentials,
} from '../config/settings.js';
import { qrRegisterFeishu } from '../feishu/qr-register.js';
import { execa } from 'execa';

type Screen = 'main' | 'claude' | 'feishu' | 'github' | 'ecc';

const components = ['claude', 'feishu', 'github', 'ecc'] as const;
const componentNames = ['Claude Code', 'Feishu', 'GitHub', 'ECC'];

function App() {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>('main');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [statuses, setStatuses] = useState<Record<string, ComponentStatus>>({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    setStatuses(getAllStatuses());
  }, []);

  const refreshStatuses = useCallback(() => {
    setStatuses(getAllStatuses());
  }, []);

  // 主界面键盘监听
  useInput((input, key) => {
    if (screen !== 'main') return;

    if (key.upArrow || input === 'k') {
      setSelectedIndex((prev) => (prev - 1 + components.length) % components.length);
    } else if (key.downArrow || input === 'j') {
      setSelectedIndex((prev) => (prev + 1) % components.length);
    } else if (key.return) {
      setScreen(components[selectedIndex]);
      setSelectedIndex(0);
      setMessage('');
    } else if (input === 'q') {
      exit();
    }
  });

  // 子页面配置
  const [subIndex, setSubIndex] = useState(0);
  const [inputMode, setInputMode] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [tempAppId, setTempAppId] = useState('');

  // 子页面键盘监听
  useInput(async (input, key) => {
    if (screen === 'main') return;

    // 输入模式
    if (inputMode) {
      if (key.return) {
        if (inputMode === 'claude-key') {
          setClaudeApiKey(inputValue);
          setMessage(chalk.green('✓ API key saved'));
          setInputMode(null);
          setInputValue('');
          refreshStatuses();
        } else if (inputMode === 'feishu-appid') {
          setTempAppId(inputValue);
          setInputMode('feishu-secret');
          setInputValue('');
          setMessage('Enter FEISHU_APP_SECRET:');
        } else if (inputMode === 'feishu-secret') {
          setFeishuCredentials(tempAppId, inputValue);
          setMessage(chalk.green('✓ Feishu credentials saved'));
          setInputMode(null);
          setInputValue('');
          setTempAppId('');
          refreshStatuses();
        }
      } else if (key.escape) {
        setInputMode(null);
        setInputValue('');
        setTempAppId('');
        setMessage('');
      } else if (key.backspace || key.delete) {
        setInputValue((prev) => prev.slice(0, -1));
      } else if (input && input.length === 1) {
        setInputValue((prev) => prev + input);
      }
      return;
    }

    // ESC 返回主菜单
    if (key.escape) {
      setScreen('main');
      setSelectedIndex(components.indexOf(screen));
      setMessage('');
      refreshStatuses();
      return;
    }

    // 列表导航
    if (key.upArrow || input === 'k') {
      const maxIndex = getMaxIndex(screen, statuses);
      setSubIndex((prev) => (prev - 1 + maxIndex) % maxIndex);
    } else if (key.downArrow || input === 'j') {
      const maxIndex = getMaxIndex(screen, statuses);
      setSubIndex((prev) => (prev + 1) % maxIndex);
    } else if (key.return) {
      await executeAction(screen, subIndex, statuses, {
        setMessage,
        setInputMode,
        setInputValue,
        setTempAppId,
        refreshStatuses,
        setScreen,
      });
    }
  });

  // 渲染主界面
  if (screen === 'main') {
    const items = components.map((key, index) => ({
      key,
      label: componentNames[index],
      description: statuses[key]?.message || '...',
    }));

    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">Feishu Agent Setup</Text>
        <Text dimColor>{'='.repeat(30)}</Text>
        <Text dimColor>↑↓ navigate | Enter configure | q quit</Text>
        <Box marginTop={1}>
          <SelectList items={items} selectedIndex={selectedIndex} />
        </Box>
      </Box>
    );
  }

  // 渲染子页面
  const { options, status } = getScreenConfig(screen, statuses);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">{componentNames[components.indexOf(screen)]} Configuration</Text>
      <Text dimColor>{'='.repeat(30)}</Text>
      {status && <Text dimColor>Status: {status}</Text>}
      <Text dimColor>↑↓ navigate | Enter select | ESC back</Text>
      <Box marginTop={1}>
        <SelectList items={options} selectedIndex={subIndex} />
      </Box>
      {message && (
        <Box marginTop={1}>
          <Text>{message}</Text>
          {inputMode && <Text color="cyan"> {inputValue}</Text>}
        </Box>
      )}
    </Box>
  );
}

function getMaxIndex(screen: Screen, statuses: Record<string, ComponentStatus>): number {
  const config = getScreenConfig(screen, statuses);
  return config.options.length;
}

function getScreenConfig(screen: Screen, statuses: Record<string, ComponentStatus>) {
  if (screen === 'claude') {
    const configured = !!getClaudeApiKey();
    return {
      status: statuses.claude?.message,
      options: configured
        ? [
            { key: 'reconfigure', label: 'Reconfigure', description: 'Enter new API key' },
            { key: 'reset', label: 'Reset', description: 'Remove API key' },
            { key: 'back', label: 'Back', description: 'Return to main menu' },
          ]
        : [
            { key: 'enter', label: 'Enter API Key', description: 'Input ANTHROPIC_API_KEY' },
            { key: 'back', label: 'Back', description: 'Return to main menu' },
          ],
    };
  }

  if (screen === 'feishu') {
    const configured = statuses.feishu?.configured;
    return {
      status: statuses.feishu?.message,
      options: configured
        ? [
            { key: 'reconfigure', label: 'Reconfigure', description: 'Enter credentials manually' },
            { key: 'scan', label: 'Scan QR', description: 'Create bot via QR code' },
            { key: 'reset', label: 'Reset', description: 'Remove credentials' },
            { key: 'back', label: 'Back', description: 'Return to main menu' },
          ]
        : [
            { key: 'manual', label: 'Enter Credentials', description: 'Input APP_ID and SECRET' },
            { key: 'scan', label: 'Scan QR', description: 'Create bot via QR code (Recommended)' },
            { key: 'back', label: 'Back', description: 'Return to main menu' },
          ],
    };
  }

  if (screen === 'github') {
    const configured = statuses.github?.configured;
    return {
      status: statuses.github?.message,
      options: configured
        ? [
            { key: 'logout', label: 'Logout', description: 'Sign out from GitHub' },
            { key: 'back', label: 'Back', description: 'Return to main menu' },
          ]
        : [
            { key: 'login', label: 'Login', description: 'OAuth with GitHub' },
            { key: 'back', label: 'Back', description: 'Return to main menu' },
          ],
    };
  }

  if (screen === 'ecc') {
    const eccStatus = getEccPluginStatus();
    return {
      status: eccStatus.installed ? `v${eccStatus.version} installed` : 'Not installed',
      options: eccStatus.installed
        ? [
            { key: 'update', label: 'Update', description: 'Update to latest version' },
            { key: 'back', label: 'Back', description: 'Return to main menu' },
          ]
        : [
            { key: 'install', label: 'Install', description: 'Install ECC plugin' },
            { key: 'back', label: 'Back', description: 'Return to main menu' },
          ],
    };
  }

  return { status: '', options: [{ key: 'back', label: 'Back', description: 'Return to main menu' }] };
}

async function executeAction(
  screen: Screen,
  index: number,
  statuses: Record<string, ComponentStatus>,
  handlers: {
    setMessage: (msg: string) => void;
    setInputMode: (mode: string | null) => void;
    setInputValue: (val: string) => void;
    setTempAppId: (id: string) => void;
    refreshStatuses: () => void;
    setScreen: (s: Screen) => void;
  }
) {
  const { setMessage, setInputMode, setInputValue, setTempAppId, refreshStatuses, setScreen } = handlers;
  const config = getScreenConfig(screen, statuses);
  const option = config.options[index];

  if (option.key === 'back') {
    setScreen('main');
    return;
  }

  // Claude actions
  if (screen === 'claude') {
    if (option.key === 'enter' || option.key === 'reconfigure') {
      setInputMode('claude-key');
      setMessage('Enter ANTHROPIC_API_KEY:');
      setInputValue('');
    } else if (option.key === 'reset') {
      resetClaudeApiKey();
      setMessage(chalk.green('✓ API key removed'));
      refreshStatuses();
    }
  }

  // Feishu actions
  if (screen === 'feishu') {
    if (option.key === 'manual' || option.key === 'reconfigure') {
      setInputMode('feishu-appid');
      setMessage('Enter FEISHU_APP_ID:');
      setInputValue('');
    } else if (option.key === 'scan') {
      const result = await qrRegisterFeishu();
      if (result) {
        setFeishuCredentials(result.app_id, result.app_secret);
        setMessage(chalk.green('✓ Feishu credentials saved'));
        refreshStatuses();
      }
    } else if (option.key === 'reset') {
      resetFeishuCredentials();
      setMessage(chalk.green('✓ Feishu credentials removed'));
      refreshStatuses();
    }
  }

  // GitHub actions
  if (screen === 'github') {
    if (option.key === 'login') {
      await execa('gh', ['auth', 'login', '--git-protocol', 'https', '--web'], { stdio: 'inherit' });
      setMessage(chalk.green('✓ GitHub authenticated'));
      refreshStatuses();
    } else if (option.key === 'logout') {
      await execa('gh', ['auth', 'logout', '--hostname', 'github.com']);
      setMessage(chalk.green('✓ Logged out'));
      refreshStatuses();
    }
  }

  // ECC actions
  if (screen === 'ecc') {
    if (option.key === 'install') {
      await execa('claude', ['plugins', 'install', 'everything-claude-code@everything-claude-code']);
      setMessage(chalk.green('✓ ECC plugin installed'));
      refreshStatuses();
    } else if (option.key === 'update') {
      await execa('claude', ['plugins', 'update', 'everything-claude-code@everything-claude-code']);
      setMessage(chalk.green('✓ ECC plugin updated'));
      refreshStatuses();
    }
  }
}

render(<App />);
