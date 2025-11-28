/**
 * Redis Connection Test Utility
 * Use this to verify Redis is working correctly
 */

import { getRedisClient, isRedisAvailable } from './client';
import { setCached, getCached, deleteCached } from './cache';

export async function testRedisConnection(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    // Check for common configuration errors
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl?.startsWith('https://')) {
      return {
        success: false,
        message: 'You are using the REST URL instead of the Redis URL. Upstash provides two URLs - use the Redis URL (starts with rediss://) not the REST URL (starts with https://). Format: rediss://default:password@host:port',
        details: {
          currentUrl: redisUrl.substring(0, 50) + '...',
          issue: 'REST URL detected',
          solution: 'Use the Redis URL from Upstash dashboard (starts with rediss://)',
        },
      };
    }

    // Test 1: Try to get client and capture actual error
    let client: any = null;
    let connectionError: any = null;
    
    try {
      client = await getRedisClient();
      if (client) {
        // Try to ping to verify connection
        try {
          await client.ping();
        } catch (pingError) {
          connectionError = pingError;
        }
      } else {
        connectionError = new Error('getRedisClient returned null');
      }
    } catch (error) {
      connectionError = error;
    }
    
    if (!client || connectionError) {
      const errorDetails: any = {
        hasRedisUrl: !!process.env.REDIS_URL,
        hasRedisPassword: !!process.env.REDIS_PASSWORD,
        connectionError: connectionError ? (connectionError instanceof Error ? connectionError.message : String(connectionError)) : 'Client returned null',
      };
      
      if (process.env.REDIS_URL) {
        errorDetails.urlFormat = process.env.REDIS_URL.startsWith('rediss://') 
          ? 'correct (rediss://)' 
          : process.env.REDIS_URL.startsWith('redis://')
          ? 'missing TLS (use rediss://)'
          : 'incorrect format';
        errorDetails.urlPreview = process.env.REDIS_URL.substring(0, 50) + '...';
      }
      
      return {
        success: false,
        message: connectionError 
          ? `Redis connection failed: ${connectionError instanceof Error ? connectionError.message : String(connectionError)}. Check Vercel logs for detailed error information.`
          : 'Redis is not available. Check your connection settings and Vercel logs for details.',
        details: errorDetails,
      };
    }

    // Test 2: Client is verified, proceed with tests

    // Test 3: Test PING
    const pingResult = await client.ping();
    if (pingResult !== 'PONG') {
      return {
        success: false,
        message: `Redis PING failed. Got: ${pingResult}`,
      };
    }

    // Test 4: Test SET/GET
    const testKey = 'test:connection:' + Date.now();
    const testValue = { message: 'Redis is working!', timestamp: new Date().toISOString() };
    
    await setCached(testKey, testValue, 10);
    const retrieved = await getCached<typeof testValue>(testKey);
    
    if (!retrieved || retrieved.message !== testValue.message) {
      return {
        success: false,
        message: 'Redis SET/GET test failed. Data mismatch.',
        details: { expected: testValue, got: retrieved },
      };
    }

    // Test 4: Test DELETE
    await deleteCached(testKey);
    const afterDelete = await getCached(testKey);
    if (afterDelete !== null) {
      return {
        success: false,
        message: 'Redis DELETE test failed. Key still exists.',
      };
    }

    // Test 5: Get Redis info
    const info = await client.info('server');
    const versionMatch = info.match(/redis_version:([^\r\n]+)/);
    const version = versionMatch ? versionMatch[1] : 'unknown';

    return {
      success: true,
      message: 'Redis is working correctly!',
      details: {
        version,
        ping: pingResult,
        setGetTest: 'passed',
        deleteTest: 'passed',
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails: any = {
      error: errorMessage,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    };
    
    if (error instanceof Error && error.stack) {
      errorDetails.stack = error.stack.substring(0, 500);
    }
    
    return {
      success: false,
      message: `Redis test failed: ${errorMessage}`,
      details: errorDetails,
    };
  }
}

