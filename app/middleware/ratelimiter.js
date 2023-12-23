/*
 * @Author: 姜彦汐
 * @Date: 2021-04-20 14:07:22
 * @LastEditors: 姜彦汐
 * @LastEditTime: 2021-08-20 16:08:58
 * @Description:
 * @Site: https://www.undsky.com
 */
const ioredis = require("ioredis");
const {
  RateLimiterRedis,
  RateLimiterMemory,
} = require("rate-limiter-flexible");

module.exports = (options, app) => {
  let limiter;
  const { points, duration, redis } = options;

  if (redis) {
    redis.enable_offline_queue = false;
    limiter = new RateLimiterRedis({
      points,
      duration,
      storeClient: ioredis.createClient(redis),
    });
  } else {
    limiter = new RateLimiterMemory(options);
  }

  return async function ratelimiter(ctx, next) {
    const ip = ctx.request.ip;
    try {
      await limiter.consume(ip);
    } catch (error) {
      ctx.coreLogger.error({
        ip,
        error,
        auth: ctx.state.user || ctx.session,
        body: ctx.request.body,
      });
      ctx.set({
        "Retry-After": error.msBeforeNext / 1000,
        "X-RateLimit-Limit": points,
        "X-RateLimit-Remaining": error.remainingPoints,
        "X-RateLimit-Reset": new Date(Date.now() + error.msBeforeNext),
      });
      return (ctx.body = {
        code: 429,
        message: "Too Many Requests",
      });
    }
    await next();
  };
};
