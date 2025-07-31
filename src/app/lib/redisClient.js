const REDIS_COUNTER_KEY = 'limit'
const RETRY_DELAY_MS = 5000
const MAX_CONCURRENT = 295
import { Redis } from '@upstash/redis'

const RedisClient = new Redis({
    url: 'https://discrete-leech-12624.upstash.io',
    token: 'ATFQAAIjcDEyZDdhNmEyNmNiMWM0ZDdjYTA5NmJlNmMwYTg2NWZlMnAxMA',
})

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
export async function waitForSlot() {
    if (!RedisClient) throw new Error("Redis client not available"); // Ensure Redis is connected

    while (true) {
        const currentCountStr = await RedisClient.get(REDIS_COUNTER_KEY);
        const currentCount = parseInt(currentCountStr || '0', 10); // Parse as base 10

        if (currentCount < MAX_CONCURRENT) {
            // Attempt to increment. INCR is atomic.
            await RedisClient.incr(REDIS_COUNTER_KEY);
            console.log(`Slot acquired. Current count (after incr): ${currentCount + 1}`);
            break; // Exit loop, slot acquired
        } else {
            console.log(`Novita limit (${MAX_CONCURRENT}) reached. Waiting ${RETRY_DELAY_MS}ms...`);
            await sleep(RETRY_DELAY_MS);
        }
    }
}
export async function releaseSlot() {
    if (!RedisClient) {
        console.error("Redis client not available during releaseSlot");
        return;
    }
    // DECR is atomic. It's generally safe even if the counter is somehow messed up.
    const newCount = await RedisClient.decr(REDIS_COUNTER_KEY);
    console.log(`Slot released. Current count (after decr): ${newCount}`);
    // Optional: Add safety check to prevent counter going far below 0
    if (newCount < 0) {
        console.warn(`Redis counter ${REDIS_COUNTER_KEY} went below zero (${newCount}). Resetting to 0.`);
        await RedisClient.set(REDIS_COUNTER_KEY, '0');
    }
}