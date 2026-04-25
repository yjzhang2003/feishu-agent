import { HealthChecker } from './health-checker.js';
import { env } from '../config/env.js';

let healthChecker: HealthChecker | null = null;

export function startMonitor(): HealthChecker | null {
  if (!env.MONITOR_TARGET_URL) {
    console.log('[Monitor] No MONITOR_TARGET_URL configured, skipping health checker');
    return null;
  }

  healthChecker = new HealthChecker({
    targetUrl: env.MONITOR_TARGET_URL,
    intervalSec: Number(env.MONITOR_INTERVAL_SEC) || 60,
    timeoutMs: Number(env.MONITOR_TIMEOUT_MS) || 5000,
  });

  healthChecker.start();
  return healthChecker;
}

export function stopMonitor(): void {
  if (healthChecker) {
    healthChecker.stop();
    healthChecker = null;
  }
}

export function getMonitorStatus(): { running: boolean; targetUrl?: string } {
  if (!healthChecker) {
    return { running: false };
  }
  return {
    running: healthChecker.isRunning(),
    targetUrl: env.MONITOR_TARGET_URL,
  };
}

export { HealthChecker } from './health-checker.js';
