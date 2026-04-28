/**
 * Session history store - persistent per-chat session history
 * Saves to data/session-history.json, survives restarts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs';
import { resolve, dirname } from 'path';
import { log } from '../../utils/logger.js';

export interface HistoryEntry {
  directory: string;
  sessionId: string | null;
  lastUsed: string; // ISO timestamp
}

const MAX_HISTORY_PER_CHAT = 10;

interface HistoryFile {
  version: number;
  entries: Record<string, HistoryEntry[]>;
}

export class SessionHistoryStore {
  private data = new Map<string, HistoryEntry[]>();
  private filePath: string;

  constructor(repoRoot: string) {
    this.filePath = resolve(repoRoot, 'data', 'session-history.json');
    this.loadFromDisk();
  }

  loadFromDisk(): void {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8');
        const file: HistoryFile = JSON.parse(raw);
        if (file.version === 1 && file.entries) {
          for (const [chatId, entries] of Object.entries(file.entries)) {
            this.data.set(chatId, entries);
          }
        }
        log.info('history', 'Loaded session history from disk', { entries: this.data.size });
      }
    } catch (err) {
      log.warn('history', 'Failed to load session history, starting fresh', { error: String(err) });
      this.data.clear();
    }
  }

  saveToDisk(): void {
    try {
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      const file: HistoryFile = {
        version: 1,
        entries: Object.fromEntries(this.data),
      };
      const tmpPath = this.filePath + '.tmp';
      writeFileSync(tmpPath, JSON.stringify(file, null, 2), 'utf-8');
      renameSync(tmpPath, this.filePath);
    } catch (err) {
      log.error('history', 'Failed to save session history', { error: String(err) });
    }
  }

  listHistory(chatId: string): HistoryEntry[] {
    return this.data.get(chatId) ?? [];
  }

  addHistory(chatId: string, entry: Omit<HistoryEntry, 'lastUsed'>): void {
    const entries = this.data.get(chatId) ?? [];

    // Dedup: update existing entry with same directory
    const existing = entries.findIndex(e => e.directory === entry.directory);
    if (existing >= 0) {
      entries[existing] = {
        directory: entry.directory,
        sessionId: entry.sessionId ?? entries[existing].sessionId,
        lastUsed: new Date().toISOString(),
      };
    } else {
      entries.push({
        ...entry,
        lastUsed: new Date().toISOString(),
      });
    }

    // Sort by lastUsed descending
    entries.sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime());

    // Cap at max entries
    if (entries.length > MAX_HISTORY_PER_CHAT) {
      entries.length = MAX_HISTORY_PER_CHAT;
    }

    this.data.set(chatId, entries);
    this.saveToDisk();
  }

  removeHistory(chatId: string, index: number): void {
    const entries = this.data.get(chatId);
    if (!entries || index < 0 || index >= entries.length) return;
    entries.splice(index, 1);
    this.saveToDisk();
  }

  getEntry(chatId: string, index: number): HistoryEntry | null {
    const entries = this.data.get(chatId);
    if (!entries || index < 0 || index >= entries.length) return null;
    return entries[index];
  }
}
