# ruoyi-eggjs-ratelimiter

> Egg plugin for ratelimiter

基于 [rate-limiter-flexible](https://github.com/animir/node-rate-limiter-flexible) 的 Egg.js 限流插件，用于保护 API 免受恶意请求和过载。

| 公众号                                       | 微信交流群                                                      |
| -------------------------------------------- | --------------------------------------------------------------- |
| ![公众号](https://cdn.undsky.com/img/gh.jpg) | ![微信交流群](https://cdn.undsky.com/img/doudouqun.jpg?v=2.0.1) |

## 目录

- [特性](#特性)
- [安装](#安装)
- [支持的 egg 版本](#支持的-egg-版本)
- [开启插件](#开启插件)
- [配置](#配置)
- [配置参数说明](#配置参数说明)
- [限流策略](#限流策略)
- [响应格式](#响应格式)
- [日志记录](#日志记录)
- [工作原理](#工作原理)
- [常见问题](#常见问题)
- [完整示例](#完整示例)
- [测试限流](#测试限流)
- [完整项目](#完整项目)
- [请我喝杯咖啡](#请我喝杯咖啡)
- [联系方式](#联系方式)
- [贡献指南](#贡献指南)
- [License](#license)


## 特性

- ✅ 基于 IP 地址的请求限流
- ✅ 支持 Redis 和内存两种存储方式
- ✅ 灵活配置请求次数和时间窗口
- ✅ 返回标准的限流响应头
- ✅ 自动记录超限请求日志
- ✅ 作为全局中间件自动启用

## 安装

```bash
$ npm i ruoyi-eggjs-ratelimiter --save
```

## 支持的 egg 版本

| egg 3.x | egg 2.x | egg 1.x |
| ------- | ------- | ------- |
| 😁      | 😁      | ❌      |

## 开启插件

```js
// {app_root}/config/plugin.js
exports.ratelimiter = {
  enable: true,
  package: "ruoyi-eggjs-ratelimiter",
};
```

## 配置

### 使用内存存储（默认）

适用于单机部署，简单快速，但重启后限流记录会丢失。

```js
// {app_root}/config/config.default.js
config.ratelimiter = {
  points: 1000, // 允许的请求次数
  duration: 1000, // 时间窗口（毫秒）
  redis: null, // 不使用 Redis
};
```

### 使用 Redis 存储（推荐）

适用于分布式部署，数据持久化，多实例共享限流状态。

```js
// {app_root}/config/config.default.js
config.ratelimiter = {
  points: 100, // 每个时间窗口允许的请求次数
  duration: 60, // 时间窗口（秒）
  redis: {
    port: 6379,
    host: "127.0.0.1",
    password: "your-password",
    db: 0,
  },
};
```

## 配置参数说明

| 参数     | 类型   | 默认值 | 说明                                                          |
| -------- | ------ | ------ | ------------------------------------------------------------- |
| points   | Number | 1000   | 时间窗口内允许的最大请求次数                                  |
| duration | Number | 1000   | 时间窗口大小，使用内存存储时单位为毫秒，使用 Redis 时单位为秒 |
| redis    | Object | null   | Redis 配置对象，为 null 时使用内存存储                        |

## 限流策略

插件会根据**客户端 IP 地址**进行限流：

- 每个 IP 在指定的时间窗口（`duration`）内最多允许 `points` 次请求
- 超出限制的请求会返回 `429 Too Many Requests` 错误
- 时间窗口滑动，而非固定周期

### 示例场景

#### 场景 1：防止暴力破解

```js
// 登录接口：每分钟最多 5 次尝试
config.ratelimiter = {
  points: 5,
  duration: 60, // 秒（使用 Redis）
  redis: {
    // Redis 配置
  },
};
```

#### 场景 2：API 调用限制

```js
// 通用 API：每秒最多 10 次请求
config.ratelimiter = {
  points: 10,
  duration: 1, // 秒（使用 Redis）
  redis: {
    // Redis 配置
  },
};
```

#### 场景 3：开发环境宽松限制

```js
// 开发环境：每秒 1000 次请求（基本不限制）
config.ratelimiter = {
  points: 1000,
  duration: 1000, // 毫秒（使用内存）
  redis: null,
};
```

## 响应格式

### 正常请求

请求在限流范围内，正常处理业务逻辑。

### 超限请求

当请求超过限制时，返回：

**HTTP 状态码：** 200（注意：body 中的 code 为 429）

**响应头：**

```
Retry-After: 5.5                           // 多少秒后可以重试
X-RateLimit-Limit: 100                     // 时间窗口内的请求限制
X-RateLimit-Remaining: 0                   // 剩余可用请求次数
X-RateLimit-Reset: Mon%20Jan%2001%202024... // 限流重置时间
```

**响应体：**

```json
{
  "code": 429,
  "message": "Too Many Requests"
}
```

## 日志记录

当请求被限流时，插件会自动记录日志：

```js
{
  ip: '192.168.1.100',              // 请求 IP
  error: RateLimiterRes { ... },   // 限流器错误对象
  auth: { userId: 1, ... },         // 用户认证信息（如果有）
  body: { username: 'test' }        // 请求体
}
```

日志会输出到 Egg.js 的 core logger。

## 工作原理

1. **插件启动**：插件在 `app.js` 中将中间件自动添加到 `coreMiddleware` 队列开头
2. **请求拦截**：每个请求都会先经过限流中间件
3. **IP 识别**：中间件通过 `ctx.request.ip` 获取客户端 IP
4. **消费令牌**：调用 `limiter.consume(ip)` 尝试消费一个请求配额
5. **放行/拒绝**：
   - 成功：继续执行后续中间件和业务逻辑
   - 失败：返回 429 错误，并设置相应的响应头

## 常见问题

### 1. 为什么选择 Redis 还是内存？

| 存储方式  | 优点                 | 缺点               | 适用场景           |
| --------- | -------------------- | ------------------ | ------------------ |
| **内存**  | 速度快，无需额外服务 | 重启丢失，单机限流 | 开发环境、单机部署 |
| **Redis** | 持久化，分布式共享   | 需要 Redis 服务    | 生产环境、集群部署 |

### 2. 如何针对不同路由设置不同的限流策略？

当前插件作为全局中间件运行，如需细粒度控制，建议：

```js
// 在具体的 controller 中使用自定义限流逻辑
// 或者在路由中间件中根据路径配置不同参数
```

### 3. 如何获取真实 IP？

确保在 Nginx 等反向代理中正确配置 `X-Forwarded-For`：

```nginx
location / {
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_pass http://127.0.0.1:7001;
}
```

Egg.js 配置：

```js
// config/config.default.js
config.proxy = true; // 启用代理模式，信任 X-Forwarded-For
```

### 4. 限流时间窗口的单位为什么不一致？

- **使用 Redis**：`duration` 单位为**秒**（rate-limiter-flexible 的 Redis 实现要求）
- **使用内存**：`duration` 单位为**毫秒**（rate-limiter-flexible 的内存实现支持）

建议根据实际使用的存储方式选择合适的单位。

## 完整示例

```js
// config/plugin.js
exports.ratelimiter = {
  enable: true,
  package: "ruoyi-eggjs-ratelimiter",
};

// config/config.prod.js
exports.ratelimiter = {
  points: 100, // 每分钟 100 次请求
  duration: 60, // 60 秒
  redis: {
    port: 6379,
    host: "127.0.0.1",
    password: "",
    db: 0,
  },
};

// config/config.local.js
exports.ratelimiter = {
  points: 1000, // 开发环境宽松限制
  duration: 1000, // 每秒 1000 次
  redis: null, // 使用内存存储
};
```

## 测试限流

使用 curl 或其他工具快速发送多个请求：

```bash
# 快速发送 10 个请求
for i in {1..10}; do
  curl http://localhost:7001/api/test
done
```

观察响应头和响应体的变化。

## 完整项目

参考 [ruoyi-eggjs](https://github.com/undsky/ruoyi-eggjs) 项目查看完整使用示例。

## 请我喝杯咖啡

如果项目对你有帮助，可以请我喝杯咖啡 ☕️

<img src="https://cdn.undsky.com/img/weixin10.jpg" max-width="300" height="500" /> <img src="https://cdn.undsky.com/img/zhifubao10.jpg" max-width="300" height="500" />

## 联系方式

- 🌐 **网站**: [https://www.undsky.com](https://www.undsky.com)
- 📮 **Issues**: [提交问题或建议](https://github.com/undsky/ruoyi-eggjs-ratelimiter/issues)

## 贡献指南

欢迎提交 Issue 和 Pull Request！

如果这个项目对你有帮助，请给我们一个 ⭐️ Star 支持一下！

---

## License

[MIT](LICENSE)
