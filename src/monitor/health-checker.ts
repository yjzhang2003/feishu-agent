import { setTimeout as sleep } from 'timers/promises';
import { env } from '../config/env.js';
import { writeTrigger } from '../trigger/trigger.js';
import { invokeClaudeSkill } from '../trigger/invoker.js';

export interface HealthCheckerOptions {
  targetUrl: string;
  intervalSec: number;
  timeoutMs: number;
}

export class HealthChecker {
  private options: HealthCheckerOptions;
  private running = false;
  private consecutiveFailures = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 2;

  constructor(options: HealthCheckerOptions) {
    this.options = options;
  }

  isRunning(): boolean {
    return this.running;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    console.log(`[HealthChecker] Monitoring ${this.options.targetUrl} every ${this.options.intervalSec}s`);

    while (this.running) {
      await this.check();
      await sleep(this.options.intervalSec * 1000);
    }
  }

  stop(): void {
    this.running = false;
    console.log('[HealthChecker] Stopped');
  }

  private async check(): Promise<void> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);

      const response = await fetch(this.options.targetUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.status >= 500) {
        this.consecutiveFailures++;
        console.warn(`[HealthChecker] ${response.status} from ${this.options.targetUrl} (${this.consecutiveFailures}/${this.MAX_CONSECUTIVE_FAILURES})`);

        if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
          await this.triggerRepair(`Health check failed: HTTP ${response.status} from ${this.options.targetUrl}`);
          this.consecutiveFailures = 0;
        }
      } else {
        if (this.consecutiveFailures > 0) {
          console.log(`[HealthChecker] Recovered: ${response.status}`);
        }
        this.consecutiveFailures = 0;
      }
    } catch (error) {
      this.consecutiveFailures++;
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`[HealthChecker] Error: ${msg} (${this.consecutiveFailures}/${this.MAX_CONSECUTIVE_FAILURES})`);

      if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        await this.triggerRepair(`Health check error: ${msg} for ${this.options.targetUrl}`);
        this.consecutiveFailures = 0;
      }
    }
  }

  private async triggerRepair(errorLog: string): Promise<void> {
    console.log(`[HealthChecker] Triggering auto-repair: ${errorLog}`);

    writeTrigger({
      context: `Monitor: ${this.options.targetUrl}`,
      error_log: errorLog,
      source: 'monitor',
      timestamp: new Date().toISOString(),
    });

    invokeClaudeSkill({ skill: 'auto-repair' }).catch((err) => {
      console.error('[HealthChecker] Auto-repair failed:', err);
    });
  }
}
