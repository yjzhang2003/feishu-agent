/**
 * Plugin Installer
 * Installs plugin into target directory's .claude/settings.json
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';
import { log } from '../utils/logger.js';

export interface PluginSettings {
  plugins?: Record<string, {
    version: string;
    skills: string[];
  }>;
}

export interface InstallOptions {
  targetDir: string;
  pluginName: string;
  pluginVersion: string;
  skills: string[];
}

export function installPlugin(opts: InstallOptions): void {
  const claudeDir = join(opts.targetDir, '.claude');
  const settingsPath = join(claudeDir, 'settings.json');

  // Ensure .claude directory exists
  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
    log.info('marketplace', 'Created .claude directory', { dir: claudeDir });
  }

  // Load existing settings or create new
  let settings: PluginSettings = {};
  if (existsSync(settingsPath)) {
    try {
      const content = readFileSync(settingsPath, 'utf-8');
      settings = JSON.parse(content);
    } catch {
      log.warn('marketplace', 'Failed to parse settings.json, creating new one');
    }
  }

  // Initialize plugins if not exists
  if (!settings.plugins) {
    settings.plugins = {};
  }

  // Add/update our plugin
  settings.plugins[opts.pluginName] = {
    version: opts.pluginVersion,
    skills: opts.skills,
  };

  // Write settings
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  log.info('marketplace', 'Plugin installed', { name: opts.pluginName, dir: settingsPath });
}

export function uninstallPlugin(targetDir: string, pluginName: string): void {
  const settingsPath = join(targetDir, '.claude', 'settings.json');

  if (!existsSync(settingsPath)) {
    log.warn('marketplace', 'No settings.json found');
    return;
  }

  try {
    const content = readFileSync(settingsPath, 'utf-8');
    const settings: PluginSettings = JSON.parse(content);

    if (settings.plugins?.[pluginName]) {
      delete settings.plugins[pluginName];
      writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      log.info('marketplace', 'Plugin uninstalled', { name: pluginName });
    }
  } catch (err) {
    log.error('marketplace', 'Failed to uninstall plugin', { error: String(err) });
  }
}
