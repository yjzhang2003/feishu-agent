import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Header } from './Header.js';
import { Footer } from './Footer.js';
import { execa } from 'execa';

interface GitHubScreenProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function GitHubScreen({ onSuccess, onCancel }: GitHubScreenProps) {
  const [phase, setPhase] = useState<'opening' | 'waiting' | 'success' | 'error'>('opening');
  const [message, setMessage] = useState('Opening browser for GitHub OAuth...');
  const [dots, setDots] = useState('');

  // Open browser and start polling
  useEffect(() => {
    let cancelled = false;
    let pollIntervalId: ReturnType<typeof setInterval>;

    async function startAuth() {
      try {
        // Open browser with gh auth login
        await execa('gh', ['auth', 'login', '--git-protocol', 'https', '--web'], {
          stdio: 'inherit',
        });

        if (cancelled) return;

        // Check if auth succeeded
        setPhase('waiting');
        setMessage('Waiting for authentication');
        pollIntervalId = setInterval(async () => {
          if (cancelled) return;

          try {
            const result = await execa('gh', ['auth', 'status'], { timeout: 3000 });
            if (result.exitCode === 0) {
              clearInterval(pollIntervalId);
              setPhase('success');
              setMessage('GitHub authenticated successfully!');
              setTimeout(() => onSuccess(), 1500);
            }
          } catch {
            // Still waiting
            setDots((d) => (d.length >= 3 ? '' : d + '.'));
          }
        }, 2000);
      } catch (error) {
        if (cancelled) return;
        setPhase('error');
        setMessage(`Auth failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    startAuth();

    return () => {
      cancelled = true;
      clearInterval(pollIntervalId);
    };
  }, [onSuccess]);

  useInput((input, key) => {
    if (key.escape && phase !== 'success') {
      onCancel();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Header title="GitHub Authentication" />

      <Box marginTop={1} flexDirection="column">
        {phase === 'opening' && (
          <>
            <Text dimColor>{message}</Text>
            <Text dimColor>Press ESC to cancel</Text>
          </>
        )}

        {phase === 'waiting' && (
          <>
            <Text dimColor>{message}{dots}</Text>
            <Box marginTop={1}>
              <Text color="cyan">Complete authentication in your browser</Text>
            </Box>
          </>
        )}

        {phase === 'success' && (
          <Text color="green">{message}</Text>
        )}

        {phase === 'error' && (
          <>
            <Text color="red">{message}</Text>
            <Text dimColor>Press ESC to go back</Text>
          </>
        )}
      </Box>

      <Footer hints={['ESC Cancel']} />
    </Box>
  );
}
