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
    // Test 1: Check if Redis is available
    const available = await isRedisAvailable();
    if (!available) {
      return {
        success: false,
        message: 'Redis is not available. Check your connection settings.',
      };
    }

    // Test 2: Get client and test basic operations
    const client = await getRedisClient();
    if (!client) {
      return {
        success: false,
        message: 'Failed to get Redis client.',
      };
    }

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

    // Test 5: Test DELETE
    await deleteCached(testKey);
    const afterDelete = await getCached(testKey);
    if (afterDelete !== null) {
      return {
        success: false,
        message: 'Redis DELETE test failed. Key still exists.',
      };
    }

    // Test 6: Get Redis info
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
    return {
      success: false,
      message: `Redis test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error },
    };
  }
}

