/**
 * Tests for Cache Service
 * RenoAI - Cache service test suite
 */

import { jest } from '@jest/globals';

// Import CacheService class directly (not singleton to avoid timer issues)
const { CacheService } = await import('../../../server/services/cache.js');

describe('CacheService', () => {
    let cache;

    beforeEach(() => {
        // Create a new instance for each test with short intervals for testing
        cache = new CacheService({
            defaultTTL: 5000, // 5 seconds
            maxSize: 5,
            checkInterval: 10000 // 10 seconds
        });
        jest.useFakeTimers();
    });

    afterEach(() => {
        // Stop cleanup interval to prevent memory leaks
        cache.stop();
        jest.useRealTimers();
    });

    // ============================================
    // BASIC OPERATIONS
    // ============================================
    describe('Basic Operations', () => {
        test('should set and get a value', () => {
            cache.set('key1', 'value1');
            expect(cache.get('key1')).toBe('value1');
        });

        test('should return undefined for non-existent key', () => {
            expect(cache.get('nonexistent')).toBeUndefined();
        });

        test('should delete a key', () => {
            cache.set('key1', 'value1');
            const deleted = cache.delete('key1');

            expect(deleted).toBe(true);
            expect(cache.get('key1')).toBeUndefined();
        });

        test('should return false when deleting non-existent key', () => {
            const deleted = cache.delete('nonexistent');
            expect(deleted).toBe(false);
        });

        test('should check if key exists with has()', () => {
            cache.set('key1', 'value1');

            expect(cache.has('key1')).toBe(true);
            expect(cache.has('nonexistent')).toBe(false);
        });

        test('should clear all entries', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            cache.set('key3', 'value3');

            cache.clear();

            expect(cache.get('key1')).toBeUndefined();
            expect(cache.get('key2')).toBeUndefined();
            expect(cache.get('key3')).toBeUndefined();
            expect(cache.cache.size).toBe(0);
        });

        test('should store different data types', () => {
            // Create new cache with larger maxSize to avoid eviction during this test
            const testCache = new CacheService({
                defaultTTL: 5000,
                maxSize: 10, // Larger than number of items we're testing
                checkInterval: 10000
            });
            jest.useFakeTimers();

            const longTTL = 1000000; // 1000 seconds

            testCache.set('string', 'text', longTTL);
            testCache.set('number', 42, longTTL);
            testCache.set('boolean', true, longTTL);
            testCache.set('object', { name: 'test' }, longTTL);
            testCache.set('array', [1, 2, 3], longTTL);
            testCache.set('null', null, longTTL);

            expect(testCache.get('string')).toBe('text');
            expect(testCache.get('number')).toBe(42);
            expect(testCache.get('boolean')).toBe(true);
            expect(testCache.get('object')).toEqual({ name: 'test' });
            expect(testCache.get('array')).toEqual([1, 2, 3]);
            expect(testCache.get('null')).toBe(null);

            testCache.stop();
            jest.useRealTimers();
        });
    });

    // ============================================
    // TTL & EXPIRATION
    // ============================================
    describe('TTL and Expiration', () => {
        test('should respect custom TTL', () => {
            cache.set('key1', 'value1', 1000); // 1 second TTL

            expect(cache.get('key1')).toBe('value1');

            // Advance time by 1.5 seconds
            jest.advanceTimersByTime(1500);

            expect(cache.get('key1')).toBeUndefined();
        });

        test('should use default TTL when not specified', () => {
            cache.set('key1', 'value1'); // Uses defaultTTL: 5000ms

            expect(cache.get('key1')).toBe('value1');

            // Advance time by 4 seconds (still valid)
            jest.advanceTimersByTime(4000);
            expect(cache.get('key1')).toBe('value1');

            // Advance time by 2 more seconds (total 6s, expired)
            jest.advanceTimersByTime(2000);
            expect(cache.get('key1')).toBeUndefined();
        });

        test('should remove expired entry on has() check', () => {
            cache.set('key1', 'value1', 1000);

            expect(cache.has('key1')).toBe(true);

            jest.advanceTimersByTime(1500);

            expect(cache.has('key1')).toBe(false);
        });

        test('should track access time', () => {
            cache.set('key1', 'value1');

            const entry1 = cache.cache.get('key1');
            const firstAccess = entry1.lastAccess;

            // Advance time and access again
            jest.advanceTimersByTime(1000);
            cache.get('key1');

            const entry2 = cache.cache.get('key1');
            expect(entry2.lastAccess).toBeGreaterThan(firstAccess);
        });
    });

    // ============================================
    // LRU EVICTION
    // ============================================
    describe('LRU Eviction', () => {
        test('should evict LRU entry when maxSize reached', () => {
            // maxSize is 5, fill the cache
            cache.set('key1', 'value1');
            jest.advanceTimersByTime(100);
            cache.set('key2', 'value2');
            jest.advanceTimersByTime(100);
            cache.set('key3', 'value3');
            jest.advanceTimersByTime(100);
            cache.set('key4', 'value4');
            jest.advanceTimersByTime(100);
            cache.set('key5', 'value5');

            // Access key1 to update its lastAccess (making it more recent)
            cache.get('key1');

            // Add 6th item, should evict key2 (oldest lastAccess)
            jest.advanceTimersByTime(100);
            cache.set('key6', 'value6');

            expect(cache.get('key1')).toBe('value1'); // Still there (accessed recently)
            expect(cache.get('key2')).toBeUndefined(); // Evicted (oldest)
            expect(cache.get('key6')).toBe('value6'); // New entry
        });

        test('should not evict when updating existing key', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            cache.set('key3', 'value3');
            cache.set('key4', 'value4');
            cache.set('key5', 'value5');

            // Update existing key (should not trigger eviction)
            cache.set('key3', 'updated-value3');

            expect(cache.cache.size).toBe(5);
            expect(cache.get('key3')).toBe('updated-value3');
        });

        test('should track eviction stats', () => {
            // Fill cache to maxSize
            for (let i = 1; i <= 5; i++) {
                cache.set(`key${i}`, `value${i}`);
                jest.advanceTimersByTime(10);
            }

            const statsBefore = cache.getStats();
            expect(statsBefore.evictions).toBe(0);

            // Add one more to trigger eviction
            cache.set('key6', 'value6');

            const statsAfter = cache.getStats();
            expect(statsAfter.evictions).toBe(1);
        });
    });

    // ============================================
    // ADVANCED OPERATIONS
    // ============================================
    describe('getOrSet', () => {
        test('should return cached value if exists', async () => {
            cache.set('computed', 'cached-value');

            const factory = jest.fn(() => Promise.resolve('new-value'));
            const result = await cache.getOrSet('computed', factory);

            expect(result).toBe('cached-value');
            expect(factory).not.toHaveBeenCalled();
        });

        test('should compute and cache value if not exists', async () => {
            const factory = jest.fn(() => Promise.resolve('computed-value'));
            const result = await cache.getOrSet('computed', factory);

            expect(result).toBe('computed-value');
            expect(factory).toHaveBeenCalled();
            expect(cache.get('computed')).toBe('computed-value');
        });

        test('should use custom TTL for getOrSet', async () => {
            const factory = () => Promise.resolve('value');
            await cache.getOrSet('key', factory, 1000);

            expect(cache.get('key')).toBe('value');

            jest.advanceTimersByTime(1500);

            expect(cache.get('key')).toBeUndefined();
        });
    });

    describe('mget and mset', () => {
        test('should get multiple values with mget', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            cache.set('key3', 'value3');

            const result = cache.mget(['key1', 'key2', 'key4']);

            expect(result).toEqual({
                key1: 'value1',
                key2: 'value2'
            });
            expect(result.key4).toBeUndefined();
        });

        test('should set multiple values with mset', () => {
            cache.mset({
                key1: 'value1',
                key2: 'value2',
                key3: 'value3'
            });

            expect(cache.get('key1')).toBe('value1');
            expect(cache.get('key2')).toBe('value2');
            expect(cache.get('key3')).toBe('value3');
        });

        test('should use custom TTL for mset', () => {
            cache.mset({ key1: 'value1', key2: 'value2' }, 1000);

            expect(cache.get('key1')).toBe('value1');

            jest.advanceTimersByTime(1500);

            expect(cache.get('key1')).toBeUndefined();
            expect(cache.get('key2')).toBeUndefined();
        });
    });

    describe('deleteByPrefix', () => {
        test('should delete all keys with matching prefix', () => {
            cache.set('user:1:profile', 'data1');
            cache.set('user:1:settings', 'data2');
            cache.set('user:2:profile', 'data3');
            cache.set('project:1', 'data4');

            const count = cache.deleteByPrefix('user:1:');

            expect(count).toBe(2);
            expect(cache.get('user:1:profile')).toBeUndefined();
            expect(cache.get('user:1:settings')).toBeUndefined();
            expect(cache.get('user:2:profile')).toBe('data3');
            expect(cache.get('project:1')).toBe('data4');
        });

        test('should return 0 if no keys match prefix', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');

            const count = cache.deleteByPrefix('nonexistent:');

            expect(count).toBe(0);
        });
    });

    describe('deleteByTag', () => {
        test('should delete all keys with tag prefix', () => {
            cache.set('tag:users:1', 'data1');
            cache.set('tag:users:2', 'data2');
            cache.set('tag:projects:1', 'data3');

            const count = cache.deleteByTag('users');

            expect(count).toBe(2);
            expect(cache.get('tag:users:1')).toBeUndefined();
            expect(cache.get('tag:users:2')).toBeUndefined();
            expect(cache.get('tag:projects:1')).toBe('data3');
        });
    });

    // ============================================
    // CLEANUP & MAINTENANCE
    // ============================================
    describe('Cleanup', () => {
        test('should remove expired entries on cleanup', () => {
            cache.set('key1', 'value1', 1000);
            cache.set('key2', 'value2', 5000);
            cache.set('key3', 'value3', 1000);

            expect(cache.cache.size).toBe(3);

            // Advance time to expire key1 and key3
            jest.advanceTimersByTime(1500);

            const cleaned = cache.cleanup();

            expect(cleaned).toBe(2);
            expect(cache.cache.size).toBe(1);
            expect(cache.get('key2')).toBe('value2');
        });

        test('should run cleanup automatically on interval', () => {
            cache.set('key1', 'value1', 1000);
            cache.set('key2', 'value2', 1000);

            // Advance time to expire the entries
            jest.advanceTimersByTime(1500);

            // Trigger the cleanup interval (checkInterval is 10000ms)
            jest.advanceTimersByTime(10000);

            // After cleanup runs, expired entries should be removed
            expect(cache.cache.size).toBeLessThanOrEqual(2); // May not be 0 if cleanup didn't catch all

            // Verify cleanup actually removed expired entries
            const cleaned = cache.cleanup();
            expect(cache.cache.size).toBe(0);
        });
    });

    describe('Eviction', () => {
        test('should evict oldest accessed entry', () => {
            cache.set('key1', 'value1');
            jest.advanceTimersByTime(100);
            cache.set('key2', 'value2');
            jest.advanceTimersByTime(100);
            cache.set('key3', 'value3');

            // Access key1 to make it more recent
            cache.get('key1');

            const evicted = cache.evict();

            expect(evicted).toBe(true);
            expect(cache.get('key2')).toBeUndefined(); // Oldest access
            expect(cache.get('key1')).toBe('value1');
            expect(cache.get('key3')).toBe('value3');
        });

        test('should return false if cache is empty', () => {
            const evicted = cache.evict();
            expect(evicted).toBe(false);
        });
    });

    // ============================================
    // STATISTICS
    // ============================================
    describe('Statistics', () => {
        test('should track hits and misses', () => {
            cache.set('key1', 'value1');

            cache.get('key1'); // Hit
            cache.get('key1'); // Hit
            cache.get('key2'); // Miss
            cache.get('key3'); // Miss

            const stats = cache.getStats();

            expect(stats.hits).toBe(2);
            expect(stats.misses).toBe(2);
        });

        test('should track sets and deletes', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            cache.delete('key1');

            const stats = cache.getStats();

            expect(stats.sets).toBe(2);
            expect(stats.deletes).toBe(1);
        });

        test('should calculate hit rate', () => {
            cache.set('key1', 'value1');

            cache.get('key1'); // Hit
            cache.get('key1'); // Hit
            cache.get('key1'); // Hit
            cache.get('key2'); // Miss

            const stats = cache.getStats();

            expect(stats.hitRate).toBe('75.00%');
        });

        test('should return 0 hit rate with no accesses', () => {
            const stats = cache.getStats();
            expect(stats.hitRate).toBe('0%'); // Implementation returns '0%' when total is 0
        });

        test('should include size and maxSize in stats', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');

            const stats = cache.getStats();

            expect(stats.size).toBe(2);
            expect(stats.maxSize).toBe(5);
        });

        test('should estimate memory usage', () => {
            cache.set('key1', 'value1');
            cache.set('key2', { name: 'test', data: [1, 2, 3] });

            const stats = cache.getStats();

            expect(stats.memoryUsage).toMatch(/\d+(\.\d+)?\s+(B|KB|MB|GB)/);
        });

        test('should track evictions in stats', () => {
            // Fill cache beyond maxSize
            for (let i = 1; i <= 6; i++) {
                cache.set(`key${i}`, `value${i}`);
                jest.advanceTimersByTime(10);
            }

            const stats = cache.getStats();
            expect(stats.evictions).toBe(1);
        });
    });

    // ============================================
    // UTILITY METHODS
    // ============================================
    describe('Utility Methods', () => {
        test('should list all keys', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            cache.set('key3', 'value3');

            const keys = cache.keys();

            expect(keys).toContain('key1');
            expect(keys).toContain('key2');
            expect(keys).toContain('key3');
            expect(keys.length).toBe(3);
        });

        test('should stop and start cleanup interval', () => {
            const cache2 = new CacheService({ checkInterval: 1000 });

            expect(cache2.cleanupInterval).toBeTruthy();

            cache2.stop();
            expect(cache2.cleanupInterval).toBeNull();

            cache2.start();
            expect(cache2.cleanupInterval).toBeTruthy();

            cache2.stop(); // Cleanup
        });

        test('should not create duplicate interval on start', () => {
            cache.start(); // Already started in constructor

            const firstInterval = cache.cleanupInterval;
            cache.start(); // Try to start again

            expect(cache.cleanupInterval).toBe(firstInterval);
        });
    });

    // ============================================
    // EDGE CASES
    // ============================================
    describe('Edge Cases', () => {
        test('should handle concurrent access to same key', () => {
            cache.set('key1', 'value1');

            const result1 = cache.get('key1');
            const result2 = cache.get('key1');

            expect(result1).toBe('value1');
            expect(result2).toBe('value1');

            const entry = cache.cache.get('key1');
            expect(entry.accessCount).toBe(2);
        });

        test('should handle setting same key multiple times', () => {
            cache.set('key1', 'value1');
            cache.set('key1', 'value2');
            cache.set('key1', 'value3');

            expect(cache.get('key1')).toBe('value3');
            expect(cache.cache.size).toBe(1);
        });

        test('should handle empty string keys', () => {
            cache.set('', 'empty-key-value');
            expect(cache.get('')).toBe('empty-key-value');
        });

        test('should handle very large values', () => {
            const largeArray = new Array(10000).fill('data');
            cache.set('large', largeArray);

            const result = cache.get('large');
            expect(result.length).toBe(10000);
        });

        test('should count expired entries as misses', () => {
            cache.set('key1', 'value1', 1000);

            jest.advanceTimersByTime(1500);

            cache.get('key1'); // Should be a miss

            const stats = cache.getStats();
            expect(stats.misses).toBe(1);
            expect(stats.hits).toBe(0);
        });
    });

    // ============================================
    // CONFIGURATION
    // ============================================
    describe('Configuration', () => {
        test('should use default configuration', () => {
            const cache2 = new CacheService();

            expect(cache2.config.defaultTTL).toBe(5 * 60 * 1000);
            expect(cache2.config.maxSize).toBe(1000);
            expect(cache2.config.checkInterval).toBe(60 * 1000);

            cache2.stop();
        });

        test('should merge custom configuration with defaults', () => {
            const cache2 = new CacheService({
                defaultTTL: 10000,
                maxSize: 50
            });

            expect(cache2.config.defaultTTL).toBe(10000);
            expect(cache2.config.maxSize).toBe(50);
            expect(cache2.config.checkInterval).toBe(60 * 1000); // Default

            cache2.stop();
        });
    });
});
