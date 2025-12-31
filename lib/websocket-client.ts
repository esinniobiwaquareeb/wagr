"use client";

import { io, Socket } from "socket.io-client";
import { logger } from "./logger";

export interface WebSocketEvents {
  notification: (data: any) => void;
  wager_update: (data: { wager_id: string; [key: string]: any }) => void;
  activity: (data: any) => void;
  balance_update: (data: { balance: number }) => void;
  connect: () => void;
  disconnect: () => void;
  error: (error: Error) => void;
}

class WebSocketClient {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private listeners: Map<string, Set<Function>> = new Map();
  private isConnecting = false;

  /**
   * Connect to WebSocket server
   */
  connect(token: string): void {
    if (this.socket?.connected || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL?.replace(/^http/, 'ws') || 'ws://localhost:3000';

    this.socket = io(wsUrl, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 5000,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      logger.info('WebSocket connected');
      this.reconnectAttempts = 0;
      this.isConnecting = false;
      this.emit('connect');
    });

    this.socket.on('disconnect', (reason) => {
      logger.warn('WebSocket disconnected', { reason });
      this.isConnecting = false;
      this.emit('disconnect');
    });

    this.socket.on('connect_error', (error) => {
      logger.error('WebSocket connection error', error);
      this.isConnecting = false;
      this.emit('error', error);
    });

    // Forward server events to listeners
    this.socket.on('notification', (data) => {
      this.emit('notification', data);
    });

    this.socket.on('wager_update', (data) => {
      this.emit('wager_update', data);
    });

    this.socket.on('activity', (data) => {
      this.emit('activity', data);
    });

    this.socket.on('balance_update', (data) => {
      this.emit('balance_update', data);
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.listeners.clear();
      this.isConnecting = false;
    }
  }

  /**
   * Subscribe to a wager for real-time updates
   */
  subscribeToWager(wagerId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('subscribe:wager', { wager_id: wagerId });
    }
  }

  /**
   * Unsubscribe from a wager
   */
  unsubscribeFromWager(wagerId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe:wager', { wager_id: wagerId });
    }
  }

  /**
   * Subscribe to activity feed
   */
  subscribeToActivity(): void {
    if (this.socket?.connected) {
      this.socket.emit('subscribe:activity');
    }
  }

  /**
   * Unsubscribe from activity feed
   */
  unsubscribeFromActivity(): void {
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe:activity');
    }
  }

  /**
   * Add event listener
   */
  on<K extends keyof WebSocketEvents>(event: K, callback: WebSocketEvents[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof WebSocketEvents>(event: K, callback: WebSocketEvents[K]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  /**
   * Emit event to listeners
   */
  private emit<K extends keyof WebSocketEvents>(event: K, ...args: Parameters<WebSocketEvents[K]>): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          (callback as any)(...args);
        } catch (error) {
          logger.error(`Error in WebSocket event handler for ${event}`, error);
        }
      });
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Send ping to server
   */
  ping(): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Not connected'));
        return;
      }

      this.socket.emit('ping', (response: { pong: number }) => {
        resolve(response.pong);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        reject(new Error('Ping timeout'));
      }, 5000);
    });
  }
}

// Singleton instance
export const websocketClient = new WebSocketClient();

