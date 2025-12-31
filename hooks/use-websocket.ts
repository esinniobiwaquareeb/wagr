"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "./use-auth";
import { websocketClient } from "@/lib/websocket-client";
import { logger } from "@/lib/logger";

export interface UseWebSocketOptions {
  onNotification?: (data: any) => void;
  onWagerUpdate?: (data: { wager_id: string; [key: string]: any }) => void;
  onActivity?: (data: any) => void;
  onBalanceUpdate?: (data: { balance: number }) => void;
  autoConnect?: boolean;
  subscribeToActivity?: boolean;
  subscribeToWagers?: string[]; // Array of wager IDs to subscribe to
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onNotification,
    onWagerUpdate,
    onActivity,
    onBalanceUpdate,
    autoConnect = true,
    subscribeToActivity = false,
    subscribeToWagers = [],
  } = options;

  const { user } = useAuth();
  // Get token from cookies or localStorage
  const token = typeof window !== 'undefined' 
    ? (document.cookie.match(/auth_token=([^;]+)/)?.[1] || localStorage.getItem('auth_token'))
    : null;
  const callbacksRef = useRef({ onNotification, onWagerUpdate, onActivity, onBalanceUpdate });
  const subscribedWagersRef = useRef<Set<string>>(new Set());

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = { onNotification, onWagerUpdate, onActivity, onBalanceUpdate };
  }, [onNotification, onWagerUpdate, onActivity, onBalanceUpdate]);

  // Setup event listeners
  useEffect(() => {
    const handleNotification = (data: any) => {
      callbacksRef.current.onNotification?.(data);
    };

    const handleWagerUpdate = (data: { wager_id: string; [key: string]: any }) => {
      callbacksRef.current.onWagerUpdate?.(data);
    };

    const handleActivity = (data: any) => {
      callbacksRef.current.onActivity?.(data);
    };

    const handleBalanceUpdate = (data: { balance: number }) => {
      callbacksRef.current.onBalanceUpdate?.(data);
    };

    websocketClient.on("notification", handleNotification);
    websocketClient.on("wager_update", handleWagerUpdate);
    websocketClient.on("activity", handleActivity);
    websocketClient.on("balance_update", handleBalanceUpdate);

    return () => {
      websocketClient.off("notification", handleNotification);
      websocketClient.off("wager_update", handleWagerUpdate);
      websocketClient.off("activity", handleActivity);
      websocketClient.off("balance_update", handleBalanceUpdate);
    };
  }, []);

  // Connect/disconnect based on auth state
  useEffect(() => {
    if (autoConnect && user && token) {
      websocketClient.connect(token);

      // Subscribe to activity feed if requested
      if (subscribeToActivity) {
        setTimeout(() => {
          websocketClient.subscribeToActivity();
        }, 1000); // Wait for connection to establish
      }

      return () => {
        websocketClient.disconnect();
      };
    } else if (!user) {
      websocketClient.disconnect();
    }
  }, [autoConnect, user, token, subscribeToActivity]);

  // Subscribe/unsubscribe to wagers
  useEffect(() => {
    if (!websocketClient.isConnected()) {
      return;
    }

    const currentSubscribed = subscribedWagersRef.current;
    const newWagers = new Set(subscribeToWagers);

    // Unsubscribe from wagers no longer in the list
    currentSubscribed.forEach((wagerId) => {
      if (!newWagers.has(wagerId)) {
        websocketClient.unsubscribeFromWager(wagerId);
        currentSubscribed.delete(wagerId);
      }
    });

    // Subscribe to new wagers
    newWagers.forEach((wagerId) => {
      if (!currentSubscribed.has(wagerId)) {
        websocketClient.subscribeToWager(wagerId);
        currentSubscribed.add(wagerId);
      }
    });
  }, [subscribeToWagers]);

  const subscribeToWager = useCallback((wagerId: string) => {
    if (websocketClient.isConnected()) {
      websocketClient.subscribeToWager(wagerId);
      subscribedWagersRef.current.add(wagerId);
    }
  }, []);

  const unsubscribeFromWager = useCallback((wagerId: string) => {
    if (websocketClient.isConnected()) {
      websocketClient.unsubscribeFromWager(wagerId);
      subscribedWagersRef.current.delete(wagerId);
    }
  }, []);

  const isConnected = useCallback(() => {
    return websocketClient.isConnected();
  }, []);

  return {
    isConnected: websocketClient.isConnected(),
    subscribeToWager,
    unsubscribeFromWager,
  };
}

