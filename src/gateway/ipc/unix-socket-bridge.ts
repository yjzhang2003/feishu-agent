/**
 * Unix Socket Bridge for Gateway-CLI IPC
 * Gateway acts as server, CLI acts as client
 */

import { createServer, type Server, type Socket } from 'net';
import { log } from '../../utils/logger.js';
import type { SessionMessage } from '../types.js';

const SOCKET_PATH = '/tmp/oh-my-feishu-gateway.sock';

export type MessageHandler = (message: SessionMessage, socket: Socket) => void;

export class UnixSocketBridge {
  private server: Server | null = null;
  private clients = new Set<Socket>();
  private handler: MessageHandler | null = null;

  async start(handler: MessageHandler): Promise<void> {
    // Remove existing socket file
    try {
      const fs = await import('fs');
      if (fs.existsSync(SOCKET_PATH)) {
        fs.unlinkSync(SOCKET_PATH);
      }
    } catch {
      // Ignore
    }

    this.handler = handler;

    return new Promise((resolve, reject) => {
      this.server = createServer((socket) => {
        log.info('ipc', 'CLI connected');

        this.clients.add(socket);

        socket.on('data', (data) => {
          try {
            const message: SessionMessage = JSON.parse(data.toString());
            if (this.handler) {
              this.handler(message, socket);
            }
          } catch (err) {
            log.error('ipc', 'Failed to parse message', { error: String(err) });
          }
        });

        socket.on('close', () => {
          log.info('ipc', 'CLI disconnected');
          this.clients.delete(socket);
        });

        socket.on('error', (err) => {
          log.error('ipc', 'Socket error', { error: String(err) });
          this.clients.delete(socket);
        });
      });

      this.server.on('error', (err) => {
        log.error('ipc', 'Server error', { error: String(err) });
        reject(err);
      });

      this.server.listen(SOCKET_PATH, () => {
        log.info('ipc', 'Gateway listening on socket', { path: SOCKET_PATH });
        resolve();
      });
    });
  }

  send(socket: Socket, message: SessionMessage): void {
    try {
      socket.write(JSON.stringify(message) + '\n');
    } catch (err) {
      log.error('ipc', 'Failed to send message', { error: String(err) });
    }
  }

  broadcast(message: SessionMessage): void {
    for (const client of this.clients) {
      this.send(client, message);
    }
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      for (const client of this.clients) {
        client.destroy();
      }
      this.clients.clear();

      if (this.server) {
        this.server.close(() => {
          log.info('ipc', 'Gateway socket server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getSocketPath(): string {
    return SOCKET_PATH;
  }
}
