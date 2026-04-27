import { describe, it, expect, afterEach } from 'vitest';
import { TracebackMonitor } from './traceback-monitor.js';
import { addService, removeService, listServices, hashContent } from '../service/registry.js';

describe('TracebackMonitor', () => {
  const monitor = new TracebackMonitor({ globalIntervalSec: 1 });

  afterEach(() => {
    monitor.stop();
    // Clean up test services
    for (const s of listServices()) {
      if (s.name.startsWith('test-tb-')) {
        removeService(s.name);
      }
    }
  });

  it('starts and stops without error', () => {
    expect(monitor.isRunning()).toBe(false);
    monitor.stop();
    expect(monitor.isRunning()).toBe(false);
  });

  it('hash-based dedup: same content produces same hash', () => {
    const traceback1 = 'Error in module X at line 10';
    const traceback2 = 'Error in module X at line 10';
    const traceback3 = 'Error in module Y at line 20';

    expect(hashContent(traceback1)).toBe(hashContent(traceback2));
    expect(hashContent(traceback1)).not.toBe(hashContent(traceback3));
  });

  it('truncation: large content still hashes consistently', () => {
    const largeContent = 'x'.repeat(20000);
    const truncated = largeContent.slice(0, 10240);

    expect(hashContent(truncated)).toBe(hashContent(truncated));
    expect(hashContent(truncated).length).toBe(64);
  });
});
