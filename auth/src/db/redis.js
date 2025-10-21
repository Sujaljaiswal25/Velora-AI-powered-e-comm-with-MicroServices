// Use an in-memory fake Redis when running tests to avoid connecting to production
if (process.env.NODE_ENV === "test") {
  class FakeRedis {
    constructor() {
      this.store = new Map();
      this.expires = new Map();
    }
    async set(key, value, ...args) {
      // Support optional EX ttl
      if (args && args.length >= 2) {
        const exIndex = args.findIndex((a) => String(a).toUpperCase() === "EX");
        if (exIndex !== -1 && args[exIndex + 1] != null) {
          const seconds = Number(args[exIndex + 1]);
          const expireAt = Date.now() + seconds * 1000;
          this.expires.set(key, expireAt);
        } else {
          this.expires.delete(key);
        }
      } else {
        this.expires.delete(key);
      }
      this.store.set(key, value);
      return "OK";
    }
    async get(key) {
      const exp = this.expires.get(key);
      if (exp && Date.now() > exp) {
        this.store.delete(key);
        this.expires.delete(key);
        return null;
      }
      return this.store.has(key) ? this.store.get(key) : null;
    }
    async del(key) {
      const existed = this.store.has(key) ? 1 : 0;
      this.store.delete(key);
      this.expires.delete(key);
      return existed;
    }
    on() {
      /* no-op in tests */
    }
    quit() {
      return Promise.resolve();
    }
  }
  module.exports = new FakeRedis();
} else {
  const { Redis } = require("ioredis");

  // Support both REDIS_PORT and the commonly-mistyped REDIS_POST from .env
  const port = Number(process.env.REDIS_PORT || process.env.REDIS_POST || 6379);

  // Configure Redis client with a few safer defaults and timeouts.
  const redis = new Redis({
    host: process.env.REDIS_HOST,
    port,
    password: process.env.REDIS_PASSWORD,
    // How long to wait for initial connection (ms)
    connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT) || 10000,
    // How many times to retry commands before erroring (null = unlimited)
    maxRetriesPerRequest: Number(process.env.REDIS_MAX_RETRIES) || 3,
    // Automatic reconnection strategy
    // times is the number of retry attempts so far
    retryStrategy(times) {
      // exponential backoff up to ~2s
      const delay = Math.min(2000, Math.pow(2, times) * 50);
      return delay;
    },
  });

  // Helpful logging and avoid unhandled 'error' events
  redis.on("connect", () => console.log("Redis: connecting..."));
  redis.on("ready", () => console.log("Redis: ready"));
  redis.on("close", () => console.log("Redis: connection closed"));
  redis.on("end", () => console.log("Redis: connection ended"));
  redis.on("error", (err) =>
    console.error("[ioredis] error:", err && err.message ? err.message : err)
  );

  module.exports = redis;
}
