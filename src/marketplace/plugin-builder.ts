/**
 * Plugin Builder
 * Packages skills into a plugin configuration
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';

export interface PluginConfig {
  name: string;
  version: string;
  skills: string[];
}

export function buildPlugin(skillsDir: string, name: string, version: string): PluginConfig {
  const skills: string[] = [];

  if (!existsSync(skillsDir)) {
    throw new Error(`Skills directory not found: ${skillsDir}`);
  }

  // Scan skills directory for skill folders
  const entries = readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skillPath = join(skillsDir, entry.name, 'SKILL.md');
      if (existsSync(skillPath)) {
        skills.push(entry.name);
      }
    }
  }

  return {
    name,
    version,
    skills,
  };
}
