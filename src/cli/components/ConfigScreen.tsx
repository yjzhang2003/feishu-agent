import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { SelectList } from './SelectList.js';

interface ConfigOption {
  key: string;
  label: string;
  description?: string;
  action: () => Promise<void> | void;
}

interface ConfigScreenProps {
  title: string;
  status?: string;
  options: ConfigOption[];
  onBack: () => void;
}

export function ConfigScreen({ title, status, options, onBack }: ConfigScreenProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [executing, setExecuting] = useState(false);

  useInput((input, key) => {
    if (executing) return;

    if (key.upArrow || input === 'k') {
      setSelectedIndex((prev) => (prev - 1 + options.length) % options.length);
    } else if (key.downArrow || input === 'j') {
      setSelectedIndex((prev) => (prev + 1) % options.length);
    } else if (key.return) {
      const option = options[selectedIndex];
      setExecuting(true);
      Promise.resolve(option.action()).finally(() => {
        setExecuting(false);
      });
    } else if (key.escape) {
      onBack();
    }
  });

  const items = options.map((opt) => ({
    key: opt.key,
    label: opt.label,
    description: opt.description,
  }));

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">{title}</Text>
      <Text dimColor>{'='.repeat(30)}</Text>
      {status && <Text dimColor>Status: {status}</Text>}
      <Text dimColor>↑↓ navigate | Enter select | ESC back</Text>
      <Box marginTop={1}>
        <SelectList items={items} selectedIndex={selectedIndex} />
      </Box>
      {executing && <Text dimColor>Processing...</Text>}
    </Box>
  );
}
