/**
 * WebSocket Handler with Redis Pub/Sub
 * Handles real-time batch job progress and analysis streaming
 */

import { WebSocket } from 'ws';
import { getRedisService } from '../services/redis';

export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'pong';
  channel?: string;
  jobId?: string;
  timestamp?: number;
}

export class WebSocketHandler {
  private redisService = getRedisService();
  private subscriptions: Map<WebSocket, Set<string>> = new Map();
  private unsubscribers: Map<WebSocket, (() => void)[]> = new Map();

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws: WebSocket): void {
    console.log('[WebSocket] New connection');

    this.subscriptions.set(ws, new Set());
    this.unsubscribers.set(ws, []);

    ws.on('message', (data: string) => {
      this.handleMessage(ws, data);
    });

    ws.on('close', () => {
      this.handleDisconnect(ws);
    });

    ws.on('error', (error: Error) => {
      console.error('[WebSocket] Error:', error);
      this.handleDisconnect(ws);
    });

    // Send welcome message
    this.send(ws, {
      type: 'pong',
      message: 'Connected to URLGuard AI WebSocket server',
      timestamp: Date.now(),
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(ws: WebSocket, data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);

      switch (message.type) {
        case 'subscribe':
          this.subscribe(ws, message.channel || message.jobId || '');
          break;

        case 'unsubscribe':
          this.unsubscribe(ws, message.channel || message.jobId || '');
          break;

        case 'ping':
          this.send(ws, {
            type: 'pong',
            timestamp: Date.now(),
          });
          break;

        default:
          console.warn('[WebSocket] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[WebSocket] Message parsing error:', error);
      this.send(ws, {
        type: 'error',
        message: 'Invalid message format',
      });
    }
  }

  /**
   * Subscribe to batch job updates
   */
  private subscribe(ws: WebSocket, channel: string): void {
    if (!channel) {
      this.send(ws, {
        type: 'error',
        message: 'Channel name required',
      });
      return;
    }

    const subscriptions = this.subscriptions.get(ws);
    if (!subscriptions) {
      return;
    }

    if (subscriptions.has(channel)) {
      console.log(`[WebSocket] Already subscribed to ${channel}`);
      return;
    }

    // Subscribe to Redis Pub/Sub
    const unsubscribe = this.redisService.subscribe(channel, (message: any) => {
      // Only send if WebSocket is still open
      if (ws.readyState === WebSocket.OPEN) {
        this.send(ws, {
          type: 'update',
          channel,
          data: message,
          timestamp: Date.now(),
        });
      }
    });

    subscriptions.add(channel);
    const unsubscribers = this.unsubscribers.get(ws) || [];
    unsubscribers.push(unsubscribe);
    this.unsubscribers.set(ws, unsubscribers);

    console.log(`[WebSocket] Subscribed to ${channel}`);

    this.send(ws, {
      type: 'subscribed',
      channel,
      timestamp: Date.now(),
    });
  }

  /**
   * Unsubscribe from batch job updates
   */
  private unsubscribe(ws: WebSocket, channel: string): void {
    const subscriptions = this.subscriptions.get(ws);
    if (!subscriptions || !subscriptions.has(channel)) {
      return;
    }

    subscriptions.delete(channel);

    console.log(`[WebSocket] Unsubscribed from ${channel}`);

    this.send(ws, {
      type: 'unsubscribed',
      channel,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle WebSocket disconnect
   */
  private handleDisconnect(ws: WebSocket): void {
    console.log('[WebSocket] Disconnected');

    // Unsubscribe from all channels
    const unsubscribers = this.unsubscribers.get(ws) || [];
    unsubscribers.forEach((unsub) => unsub());

    this.subscriptions.delete(ws);
    this.unsubscribers.delete(ws);
  }

  /**
   * Send message to WebSocket client
   */
  private send(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('[WebSocket] Send error:', error);
      }
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcastToAll(message: any): void {
    this.subscriptions.forEach((_, ws) => {
      this.send(ws, message);
    });
  }

  /**
   * Get active connection count
   */
  getConnectionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(): number {
    let total = 0;
    this.subscriptions.forEach((channels) => {
      total += channels.size;
    });
    return total;
  }
}

// Singleton instance
let wsHandler: WebSocketHandler | null = null;

export function getWebSocketHandler(): WebSocketHandler {
  if (!wsHandler) {
    wsHandler = new WebSocketHandler();
  }
  return wsHandler;
}

export default WebSocketHandler;
