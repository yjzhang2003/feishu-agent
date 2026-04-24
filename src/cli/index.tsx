#!/usr/bin/env node
import React, { useState, useEffect, useCallback } from 'react';
import { render, Box, Text, useApp, useInput, Key } from 'ink';
import TextInput from 'ink-text-input';
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

type Screen = 'main' | 'claude' | 'feishu' | 'github' | 'ecc';

// Main App
function App() {
  const { exit } = useApp();
  const [statuses, setStatuses] = useState<Record<string, ComponentStatus>>(getAllStatuses());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [screen, setScreen] = useState<Screen>('main');
  const [message, setMessage] = useState<string>('');
  const [inputValue, setInputValue] = useState('');
  const [inputStep, setInputStep] = useState(0);

  const components: Screen[] = ['claude', 'feishu', 'github', 'ecc'];
  const componentNames: Record<Screen, string> = {
    main: 'Main',
    claude: 'Claude Code',
    feishu: 'Feishu',
    github: 'GitHub',
    ecc: 'ECC',
  };

  const refreshStatuses = useCallback(() => {
    setStatuses(getAllStatuses());
  }, []);

  // Main screen keyboard navigation
  useInput((input: string, key: Key) => {
    if (screen !== 'main') return;

    if (key.upArrow) {
      setSelectedIndex((prev) => (prev - 1 + components.length) % components.length);
    } else if (key.downArrow) {
      setSelectedIndex((prev) => (prev + 1) % components.length);
    } else if (key.return) {
      setScreen(components[selectedIndex]);
      setInputValue('');
      setInputStep(0);
    } else if (key.escape) {
      exit();
    }
  });

  // Config screen keyboard
  useInput((input: string, key: Key) => {
    if (screen === 'main') return;

    if (key.escape) {
      setScreen('main');
      setMessage('');
      refreshStatuses();
    }
  });

  // Handle Claude config
  const handleClaudeSubmit = (value: string) => {
    const currentKey = getClaudeApiKey();

    if (inputStep === 0) {
      if (currentKey) {
        // Has key, ask for action
        if (value === 'r') {
          setInputStep(1);
          setInputValue('');
        } else if (value === 'x') {
          setInputStep(10); // Confirm reset
          setInputValue('');
        } else {
          setScreen('main');
          refreshStatuses();
        }
      } else {
        // No key, enter new key
        if (value) {
          setClaudeApiKey(value);
          setMessage('✓ API key saved');
        }
        setScreen('main');
        refreshStatuses();
      }
    } else if (inputStep === 1) {
      // Enter new key
      if (value) {
        setClaudeApiKey(value);
        setMessage('✓ API key updated');
      }
      setScreen('main');
      refreshStatuses();
    } else if (inputStep === 10) {
      // Confirm reset
      if (value.toLowerCase() === 'y') {
        resetClaudeApiKey();
        setMessage('✓ API key removed');
      }
      setScreen('main');
      refreshStatuses();
    }
  };

  // Handle Feishu config
  const handleFeishuSubmit = (value: string) => {
    const status = statuses.feishu;

    if (inputStep === 0) {
      if (status.configured) {
        if (value === 'r') {
          setInputStep(1);
          setInputValue('');
        } else if (value === 'x') {
          setInputStep(10);
          setInputValue('');
        } else {
          setScreen('main');
          refreshStatuses();
        }
      } else {
        // Enter app id
        if (value) {
          setInputValue('');
          setInputStep(2);
          (window as any).__feishu_app_id = value;
        } else {
          setScreen('main');
        }
      }
    } else if (inputStep === 1) {
      // Reconfigure: enter app id
      if (value) {
        setInputValue('');
        setInputStep(2);
        (window as any).__feishu_app_id = value;
      } else {
        setScreen('main');
      }
    } else if (inputStep === 2) {
      // Enter app secret
      if (value) {
        const appId = (window as any).__feishu_app_id;
        setFeishuCredentials(appId, value);
        setMessage('✓ Feishu credentials saved');
      }
      setScreen('main');
      refreshStatuses();
    } else if (inputStep === 10) {
      // Confirm reset
      if (value.toLowerCase() === 'y') {
        resetFeishuCredentials();
        setMessage('✓ Feishu credentials removed');
      }
      setScreen('main');
      refreshStatuses();
    }
  };

  // Handle GitHub config
  const handleGitHubSubmit = async (value: string) => {
    const status = statuses.github;

    if (inputStep === 0) {
      if (status.configured) {
        if (value === 'x') {
          setInputStep(10);
          setInputValue('');
        } else {
          setScreen('main');
          refreshStatuses();
        }
      } else {
        // Start login
        if (value.toLowerCase() === 'y' || value === '') {
          try {
            setMessage('Opening browser...');
            await execa('gh', ['auth', 'login', '--git-protocol', 'https', '--web'], {
              stdio: 'inherit',
            });
            setMessage('✓ GitHub authenticated');
          } catch {
            setMessage('✗ Failed to authenticate');
          }
        }
        setScreen('main');
        refreshStatuses();
      }
    } else if (inputStep === 10) {
      // Confirm logout
      if (value.toLowerCase() === 'y') {
        try {
          await execa('gh', ['auth', 'logout', '--hostname', 'github.com']);
          setMessage('✓ Logged out');
        } catch {
          setMessage('✗ Failed to logout');
        }
      }
      setScreen('main');
      refreshStatuses();
    }
  };

  // Handle ECC config
  const handleEccSubmit = async (value: string) => {
    const status = getEccPluginStatus();

    if (inputStep === 0) {
      if (status.installed) {
        if (value === 'u') {
          try {
            setMessage('Updating...');
            await execa('claude', ['plugins', 'update', 'everything-claude-code@everything-claude-code']);
            setMessage('✓ ECC plugin updated');
          } catch {
            setMessage('✗ Failed to update');
          }
        }
      } else {
        if (value.toLowerCase() === 'y' || value === '') {
          try {
            setMessage('Installing...');
            await execa('claude', ['plugins', 'install', 'everything-claude-code@everything-claude-code']);
            setMessage('✓ ECC plugin installed');
          } catch {
            setMessage('✗ Failed to install');
          }
        }
      }
      setScreen('main');
      refreshStatuses();
    }
  };

  // Render config screens
  const renderConfigScreen = () => {
    const currentKey = getClaudeApiKey();
    const eccStatus = getEccPluginStatus();

    switch (screen) {
      case 'claude':
        if (inputStep === 0 && currentKey) {
          return (
            <Box flexDirection="column">
              <Text bold color="cyan">Claude Code</Text>
              <Text dimColor>Status: {statuses.claude.message}</Text>
              <Text> </Text>
              <Text>[r] reconfigure | [x] reset | [c] cancel</Text>
              <Text> </Text>
              <TextInput value={inputValue} onChange={setInputValue} onSubmit={handleClaudeSubmit} placeholder="Enter choice..." />
            </Box>
          );
        } else if (inputStep === 10) {
          return (
            <Box flexDirection="column">
              <Text bold color="yellow">Reset API Key?</Text>
              <Text> </Text>
              <TextInput value={inputValue} onChange={setInputValue} onSubmit={handleClaudeSubmit} placeholder="y/N" />
            </Box>
          );
        } else {
          return (
            <Box flexDirection="column">
              <Text bold color="cyan">Claude Code</Text>
              <Text>Enter your ANTHROPIC_API_KEY:</Text>
              <Text> </Text>
              <TextInput value={inputValue} onChange={setInputValue} onSubmit={handleClaudeSubmit} placeholder="sk-ant-..." />
            </Box>
          );
        }

      case 'feishu':
        if (inputStep === 0 && statuses.feishu.configured) {
          return (
            <Box flexDirection="column">
              <Text bold color="cyan">Feishu</Text>
              <Text dimColor>Status: {statuses.feishu.message}</Text>
              <Text> </Text>
              <Text>[r] reconfigure | [x] reset | [c] cancel</Text>
              <Text> </Text>
              <TextInput value={inputValue} onChange={setInputValue} onSubmit={handleFeishuSubmit} placeholder="Enter choice..." />
            </Box>
          );
        } else if (inputStep === 10) {
          return (
            <Box flexDirection="column">
              <Text bold color="yellow">Reset Feishu Credentials?</Text>
              <Text> </Text>
              <TextInput value={inputValue} onChange={setInputValue} onSubmit={handleFeishuSubmit} placeholder="y/N" />
            </Box>
          );
        } else if (inputStep === 2) {
          return (
            <Box flexDirection="column">
              <Text bold color="cyan">Feishu</Text>
              <Text>Enter FEISHU_APP_SECRET:</Text>
              <Text> </Text>
              <TextInput value={inputValue} onChange={setInputValue} onSubmit={handleFeishuSubmit} placeholder="secret..." />
            </Box>
          );
        } else {
          return (
            <Box flexDirection="column">
              <Text bold color="cyan">Feishu</Text>
              <Text dimColor>Tip: Scan QR with 'feishu-agent setup' to auto-create a bot</Text>
              <Text> </Text>
              <Text>Enter FEISHU_APP_ID:</Text>
              <TextInput value={inputValue} onChange={setInputValue} onSubmit={handleFeishuSubmit} placeholder="cli_xxx..." />
            </Box>
          );
        }

      case 'github':
        if (inputStep === 0 && statuses.github.configured) {
          return (
            <Box flexDirection="column">
              <Text bold color="cyan">GitHub</Text>
              <Text dimColor>Status: {statuses.github.message}</Text>
              <Text> </Text>
              <Text>[x] logout | [c] cancel</Text>
              <Text> </Text>
              <TextInput value={inputValue} onChange={setInputValue} onSubmit={handleGitHubSubmit} placeholder="Enter choice..." />
            </Box>
          );
        } else if (inputStep === 10) {
          return (
            <Box flexDirection="column">
              <Text bold color="yellow">Logout from GitHub?</Text>
              <Text> </Text>
              <TextInput value={inputValue} onChange={setInputValue} onSubmit={handleGitHubSubmit} placeholder="y/N" />
            </Box>
          );
        } else {
          return (
            <Box flexDirection="column">
              <Text bold color="cyan">GitHub</Text>
              <Text>This will open a browser for OAuth login...</Text>
              <Text> </Text>
              <Text>Continue?</Text>
              <TextInput value={inputValue} onChange={setInputValue} onSubmit={handleGitHubSubmit} placeholder="Y/n" />
            </Box>
          );
        }

      case 'ecc':
        if (eccStatus.installed) {
          return (
            <Box flexDirection="column">
              <Text bold color="cyan">ECC Plugin</Text>
              <Text dimColor>Status: v{eccStatus.version} installed</Text>
              <Text> </Text>
              <Text>[u] update | [c] cancel</Text>
              <Text> </Text>
              <TextInput value={inputValue} onChange={setInputValue} onSubmit={handleEccSubmit} placeholder="Enter choice..." />
            </Box>
          );
        } else {
          return (
            <Box flexDirection="column">
              <Text bold color="cyan">ECC Plugin</Text>
              <Text>ECC (Everything Claude Code) provides enhanced skills and agents.</Text>
              <Text> </Text>
              <Text>Install?</Text>
              <TextInput value={inputValue} onChange={setInputValue} onSubmit={handleEccSubmit} placeholder="Y/n" />
            </Box>
          );
        }

      default:
        return null;
    }
  };

  // Main screen render
  if (screen !== 'main') {
    return (
      <Box flexDirection="column" padding={1}>
        {renderConfigScreen()}
        {message && (
          <Box marginTop={1}>
            <Text color="green">{message}</Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text dimColor>ESC to go back</Text>
        </Box>
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
            <Text bold={isSelected}> {componentNames[key]}: </Text>
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
