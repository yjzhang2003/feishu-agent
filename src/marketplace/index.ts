/**
 * Marketplace
 * Main entry point for plugin management
 */

import { resolve } from 'path';
import { env } from '../config/env.js';
import { buildPlugin, type PluginConfig } from './plugin-builder.js';
import { installPlugin, uninstallPlugin } from './plugin-installer.js';

const PLUGIN_NAME = 'oh-my-feishu';
const PLUGIN_VERSION = '1.0.0';

export interface MarketplaceOptions {
  targetDir: string;
}

export function getPluginConfig(): PluginConfig {
  const skillsDir = resolve(env.REPO_ROOT, 'workspace', '.claude', 'skills');
  return buildPlugin(skillsDir, PLUGIN_NAME, PLUGIN_VERSION);
}

export function install(options: MarketplaceOptions): void {
  const config = getPluginConfig();
  installPlugin({
    targetDir: options.targetDir,
    pluginName: config.name,
    pluginVersion: config.version,
    skills: config.skills,
  });
}

export function uninstall(options: MarketplaceOptions): void {
  uninstallPlugin(options.targetDir, PLUGIN_NAME);
}

export { type PluginConfig };
