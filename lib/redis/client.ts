/**
 * Redis Client Utility
 * Provides a centralized Redis connection for caching and performance optimization
 */

// Redis types - will be available after installing redis package
type RedisClientType = any;

let redisClient: RedisClientType | null = null;
let isConnecting = false;
let connectionPromise: Promise<RedisClientType> | null = null;

/**
 * Get or create Redis client instance
 * Uses singleton pattern to ensure single connection pool
 */
export async function getRedisClient(): Promise<RedisClientType | null> {
  // Return null if Redis is not configured (graceful degradation)
  if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
    return null;
  }

  // Return existing client if available
  if (redisClient?.isOpen) {
    return redisClient;
  }

  // If already connecting, wait for that connection
  if (isConnecting && connectionPromise) {
    return connectionPromise;
  }

  // Create new connection
  isConnecting = true;
  connectionPromise = (async () => {
    try {
      // Dynamic import to avoid errors if redis is not installed
      let createClient: any;
      try {
        const redisModule = await import('redis');
        createClient = redisModule.createClient;
      } catch (importError) {
        console.warn('Redis package not installed. Install with: npm install redis');
        isConnecting = false;
        connectionPromise = null;
        return null;
      }
      
      // Build Redis URL
      let redisUrl = process.env.REDIS_URL;
      
      // If no REDIS_URL, construct from individual components
      if (!redisUrl) {
        const host = process.env.REDIS_HOST || 'localhost';
        const port = process.env.REDIS_PORT || 6379;
        const protocol = process.env.REDIS_TLS === 'true' || process.env.REDIS_URL?.startsWith('rediss://') ? 'rediss' : 'redis';
        redisUrl = `${protocol}://${host}:${port}`;
      }

      // Upstash compatibility: Ensure TLS for Upstash URLs
      if (redisUrl.includes('upstash.io') && !redisUrl.startsWith('rediss://')) {
        redisUrl = redisUrl.replace('redis://', 'rediss://');
      }

      const client = createClient({
        url: redisUrl,
        password: process.env.REDIS_PASSWORD,
        socket: {
          reconnectStrategy: (retries: number) => {
            if (retries > 10) {
              console.error('Redis: Max reconnection attempts reached');
              return new Error('Max reconnection attempts reached');
            }
            return Math.min(retries * 100, 3000);
          },
          // Upstash requires TLS
          tls: redisUrl.startsWith('rediss://') || redisUrl.includes('upstash.io') ? {} : undefined,
        },
      });

      client.on('error', (err: Error) => {
        console.error('Redis Client Error:', err);
        // Log helpful error messages for common issues
        if (err.message.includes('TLS') || err.message.includes('SSL')) {
          console.error('Redis: TLS/SSL error. For Upstash, ensure URL uses rediss:// protocol');
        }
        if (err.message.includes('NOAUTH') || err.message.includes('Authentication')) {
          console.error('Redis: Authentication failed. Check REDIS_PASSWORD environment variable');
        }
      });

      client.on('connect', () => {
        console.log('Redis: Connected');
        if (redisUrl.includes('upstash.io')) {
          console.log('Redis: Connected to Upstash');
        }
      });

      client.on('ready', () => {
        console.log('Redis: Ready');
        isConnecting = false;
      });

      await client.connect();
      redisClient = client as RedisClientType;
      return redisClient;
    } catch (error) {
      console.error('Redis: Failed to connect', error);
      isConnecting = false;
      connectionPromise = null;
      return null;
    }
  })();

  return connectionPromise;
}

/**
 * Close Redis connection gracefully
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient?.isOpen) {
    await redisClient.quit();
    redisClient = null;
  }
  isConnecting = false;
  connectionPromise = null;
}

/**
 * Check if Redis is available
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    const client = await getRedisClient();
    if (!client) return false;
    await client.ping();
    return true;
  } catch {
    return false;
  }
}

