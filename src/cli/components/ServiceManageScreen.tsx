import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { SelectList } from './SelectList.js';
import { Footer } from './Footer.js';
import {
  listServices,
  addService,
  removeService,
  updateService,
  type ServiceEntry,
} from '../../service/registry.js';

type SubScreen = 'menu' | 'add' | 'remove' | 'toggle';

interface ServiceManageScreenProps {
  onBack: () => void;
}

interface MenuOption {
  key: string;
  label: string;
  description?: string;
}

export function ServiceManageScreen({ onBack }: ServiceManageScreenProps) {
  const [subScreen, setSubScreen] = useState<SubScreen>('menu');
  const [services, setServices] = useState<ServiceEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [message, setMessage] = useState('');
  const [messageColor, setMessageColor] = useState<'green' | 'red'>('green');

  // Add form state
  const [addStep, setAddStep] = useState(0);
  const [formName, setFormName] = useState('');
  const [formRepo, setFormRepo] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    refreshServices();
  }, []);

  const refreshServices = () => {
    setServices(listServices());
  };

  const getMenuOptions = (): MenuOption[] => {
    const options: MenuOption[] = [
      {
        key: 'add',
        label: 'Add Service',
        description: 'Register a new service for traceback monitoring',
      },
    ];
    if (services.length > 0) {
      options.push(
        {
          key: 'remove',
          label: 'Remove Service',
          description: 'Unregister an existing service',
        },
        {
          key: 'toggle',
          label: 'Enable / Disable Service',
          description: 'Toggle monitoring for a service',
        },
      );
    }
    options.push({
      key: 'back',
      label: 'Back',
      description: 'Return to service menu',
    });
    return options;
  };

  const getServiceSelectItems = () => {
    return services.map((s) => ({
      key: s.name,
      label: `${s.name} (${s.githubOwner}/${s.githubRepo})`,
      description: s.enabled ? 'enabled' : 'disabled',
      status: s.enabled ? 'on' : 'off',
      statusColor: (s.enabled ? 'green' : 'red') as 'green' | 'red',
    }));
  };

  const safeIndex = (index: number, length: number) => {
    if (length === 0) return 0;
    return ((index % length) + length) % length;
  };

  useInput((input, key) => {
    if (subScreen === 'menu') {
      const options = getMenuOptions();
      if (key.upArrow || input === 'k') {
        setSelectedIndex((prev) => safeIndex(prev - 1, options.length));
      } else if (key.downArrow || input === 'j') {
        setSelectedIndex((prev) => safeIndex(prev + 1, options.length));
      } else if (key.return) {
        const option = options[selectedIndex];
        if (option.key === 'back') {
          onBack();
        } else if (option.key === 'add') {
          setSubScreen('add');
          setAddStep(0);
          setFormName('');
          setFormRepo('');
          setFormUrl('');
          setInputValue('');
          setMessage('');
        } else if (option.key === 'remove') {
          setSubScreen('remove');
          setSelectedIndex(0);
          setMessage('');
        } else if (option.key === 'toggle') {
          setSubScreen('toggle');
          setSelectedIndex(0);
          setMessage('');
        }
      } else if (key.escape) {
        onBack();
      }
      return;
    }

    if (subScreen === 'add') {
      if (key.escape) {
        setSubScreen('menu');
        setInputValue('');
        setMessage('');
        setSelectedIndex(0);
      } else if (key.return) {
        const value = inputValue.trim();
        if (!value) return;

        if (addStep === 0) {
          setFormName(value);
          setInputValue('');
          setAddStep(1);
        } else if (addStep === 1) {
          if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(value)) {
            setMessage('Invalid format. Expected: owner/repo');
            setMessageColor('red');
            return;
          }
          setFormRepo(value);
          setInputValue('');
          setAddStep(2);
          setMessage('');
        } else if (addStep === 2) {
          if (!/^https?:\/\/.+/.test(value)) {
            setMessage('Invalid URL. Must start with http:// or https://');
            setMessageColor('red');
            return;
          }
          setFormUrl(value);
          setInputValue('');
          setAddStep(3);
          setMessage('');
        } else if (addStep === 3) {
          try {
            const [githubOwner, githubRepo] = formRepo.split('/');
            addService({
              name: formName,
              githubOwner,
              githubRepo,
              tracebackUrl: formUrl,
              notifyChatId: '',
              tracebackUrlType: 'json',
              enabled: true,
              addedAt: new Date().toISOString(),
              addedBy: 'cli',
            });
            setMessage(`Service "${formName}" registered successfully`);
            setMessageColor('green');
            refreshServices();
            setSubScreen('menu');
            setSelectedIndex(0);
          } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Failed to add service');
            setMessageColor('red');
          }
        }
      } else if (key.backspace || key.delete) {
        setInputValue((prev) => prev.slice(0, -1));
        setMessage('');
      } else if (!key.ctrl && !key.meta && input.length === 1) {
        setInputValue((prev) => prev + input);
        setMessage('');
      }
      return;
    }

    if (subScreen === 'remove' || subScreen === 'toggle') {
      const items = getServiceSelectItems();
      if (key.upArrow || input === 'k') {
        setSelectedIndex((prev) => safeIndex(prev - 1, items.length));
      } else if (key.downArrow || input === 'j') {
        setSelectedIndex((prev) => safeIndex(prev + 1, items.length));
      } else if (key.return) {
        const name = items[selectedIndex]?.key;
        if (!name) return;

        if (subScreen === 'remove') {
          if (removeService(name)) {
            const remaining = listServices();
            setServices(remaining);
            setMessage(`Service "${name}" removed`);
            setMessageColor('green');
            if (remaining.length === 0) {
              setSubScreen('menu');
              setSelectedIndex(0);
            } else {
              setSelectedIndex((prev) => safeIndex(prev, remaining.length));
            }
          }
        } else {
          const service = services.find((s) => s.name === name);
          if (service) {
            const newEnabled = !service.enabled;
            updateService(name, { enabled: newEnabled });
            const updated = listServices();
            setServices(updated);
            setMessage(`Service "${name}" ${newEnabled ? 'enabled' : 'disabled'}`);
            setMessageColor('green');
          }
        }
      } else if (key.escape) {
        setSubScreen('menu');
        setSelectedIndex(0);
        setMessage('');
      }
    }
  });

  const renderAddScreen = () => {
    const steps = [
      {
        label: 'Service name',
        hint: 'e.g. my-api',
        current: formName,
      },
      {
        label: 'GitHub repo (owner/repo)',
        hint: 'e.g. myorg/my-api',
        current: formRepo,
      },
      {
        label: 'Traceback URL',
        hint: 'e.g. https://logs.example.com/api/tracebacks',
        current: formUrl,
      },
    ];

    if (addStep < 3) {
      const step = steps[addStep];
      return (
        <Box flexDirection="column">
          <Text dimColor>
            Step {addStep + 1}/3: {step.label}
          </Text>
          <Text dimColor>Hint: {step.hint}</Text>
          {step.current && (
            <Text dimColor>
              Previous: {step.current}
            </Text>
          )}
          <Box marginTop={1}>
            <Text color="cyan">{'>'} </Text>
            <Text>{inputValue}</Text>
            <Text dimColor>_</Text>
          </Box>
        </Box>
      );
    }

    return (
      <Box flexDirection="column">
        <Text bold>Confirm registration:</Text>
        <Box marginTop={1} flexDirection="column">
          <Text>Name: {formName}</Text>
          <Text>Repo: {formRepo}</Text>
          <Text>URL: {formUrl}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press Enter to confirm, ESC to cancel</Text>
        </Box>
      </Box>
    );
  };

  const hints =
    subScreen === 'menu'
      ? ['↑↓ Navigate', 'Enter Select', 'ESC Back']
      : subScreen === 'add'
        ? ['Type to input', 'Enter Confirm', 'ESC Cancel']
        : ['↑↓ Navigate', 'Enter Select', 'ESC Back'];

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        Service Management
      </Text>
      <Text dimColor>{'='.repeat(30)}</Text>

      {subScreen === 'menu' && (
        <>
          {services.length > 0 ? (
            <Box flexDirection="column" marginTop={1} marginBottom={1}>
              <Text dimColor>Registered services ({services.length}):</Text>
              {services.map((s) => (
                <Text key={s.name} dimColor>
                  {`${s.enabled ? '🟢' : '🔴'} ${s.name} (${s.githubOwner}/${s.githubRepo})`}
                </Text>
              ))}
            </Box>
          ) : (
            <Box marginTop={1} marginBottom={1}>
              <Text dimColor>No services registered.</Text>
            </Box>
          )}
          <SelectList
            items={getMenuOptions().map((o) => ({
              key: o.key,
              label: o.label,
              description: o.description,
            }))}
            selectedIndex={selectedIndex}
          />
        </>
      )}

      {subScreen === 'add' && (
        <Box marginTop={1}>{renderAddScreen()}</Box>
      )}

      {(subScreen === 'remove' || subScreen === 'toggle') && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>
            {subScreen === 'remove'
              ? 'Select a service to remove:'
              : 'Select a service to toggle:'}
          </Text>
          <Box marginTop={1}>
            <SelectList
              items={getServiceSelectItems()}
              selectedIndex={safeIndex(selectedIndex, getServiceSelectItems().length)}
            />
          </Box>
        </Box>
      )}

      {message && (
        <Box marginTop={1}>
          <Text color={messageColor}>{message}</Text>
        </Box>
      )}

      <Footer hints={hints} />
    </Box>
  );
}
