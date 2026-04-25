import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { Header } from './Header.js';
import { Footer } from './Footer.js';
import { execa } from 'execa';

const SUCCESS_DELAY_MS = 1500;
const POLL_INTERVAL_MS = 2000;

interface GitHubScreenProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function GitHubScreen({ onSuccess, onCancel }: GitHubScreenProps) {
  const [phase, setPhase] = useState<'starting' | 'waiting' | 'success' | 'error'>('starting');
  const [message, setMessage] = useState('Starting GitHub OAuth...');
  const [dots, setDots] = useState('');

  // Track mounted state
  const mountedRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    let pollIntervalId: ReturnType<typeof setInterval>;
    let successTimeoutId: ReturnType<typeof setTimeout>;

    async function startAuth() {
      try {
        // First check if already authenticated
        const statusResult = await execa('gh', ['auth', 'status'], {
          reject: false,
          timeout: 3000,
        });

        if (statusResult.exitCode === 0) {
          // Already authenticated
          setPhase('success');
          setMessage('Already authenticated!');
          successTimeoutId = setTimeout(() => {
            if (mountedRef.current && !cancelled) onSuccess();
          }, SUCCESS_DELAY_MS);
          return;
        }

        if (cancelled || !mountedRef.current) return;

        // Start auth login with auto-answer to prompts
        setPhase('waiting');
        setMessage('Waiting for authentication in browser');

        // Use spawn with stdin pipe to auto-answer prompts
        const authProcess = execa('gh', [
          'auth', 'login',
          '--git-protocol', 'https',
          '--web',
          '--hostname', 'github.com',
        ], {
          stdin: 'pipe',
          reject: false,
        });

        // Wait a bit for the first prompt, then auto-answer
        setTimeout(() => {
          if (!cancelled && authProcess.stdin) {
            // Answer 'Y' to "Authenticate Git with your GitHub credentials?"
            authProcess.stdin.write('Y\n');
          }
        }, 500);

        // Start polling for completion
        pollIntervalId = setInterval(async () => {
          if (cancelled || !mountedRef.current) return;

          try {
            const result = await execa('gh', ['auth', 'status'], {
              reject: false,
              timeout: 3000,
            });

            if (result.exitCode === 0) {
              clearInterval(pollIntervalId);
              setPhase('success');
              setMessage('GitHub authenticated successfully!');

              // Kill the auth process if still running
              authProcess.kill();

              successTimeoutId = setTimeout(() => {
                if (mountedRef.current && !cancelled) onSuccess();
              }, SUCCESS_DELAY_MS);
            } else {
              setDots((d) => (d.length >= 3 ? '' : d + '.'));
            }
          } catch {
            setDots((d) => (d.length >= 3 ? '' : d + '.'));
          }
        }, POLL_INTERVAL_MS);

        // Wait for auth process to complete (or be killed)
        await authProcess;

      } catch (error) {
        if (cancelled || !mountedRef.current) return;
        setPhase('error');
        setMessage(`Auth failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    startAuth();

    return () => {
      cancelled = true;
      clearInterval(pollIntervalId);
      clearTimeout(successTimeoutId);
    };
  }, [onSuccess]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useInput((input, key) => {
    if (key.escape && phase !== 'success') {
      onCancel();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Header title="GitHub Authentication" />

      <Box marginTop={1} flexDirection="column">
        {phase === 'starting' && (
          <>
            <Text dimColor>{message}</Text>
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
