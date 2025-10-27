# ruoyi-eggjs-ratelimiter

> Egg plugin for ratelimiter

基于 [rate-limiter-flexible](https://github.com/animir/node-rate-limiter-flexible) 的 Egg.js 限流插件，用于保护 API 免受恶意请求和过载。

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
  points: 1000,      // 允许的请求次数
  duration: 1000,    // 时间窗口（毫秒）
  redis: null,       // 不使用 Redis
};
```

### 使用 Redis 存储（推荐）

适用于分布式部署，数据持久化，多实例共享限流状态。

```js
// {app_root}/config/config.default.js
config.ratelimiter = {
  points: 100,       // 每个时间窗口允许的请求次数
  duration: 60,      // 时间窗口（秒）
  redis: {
    port: 6379,
    host: '127.0.0.1',
    password: 'your-password',
    db: 0,
  },
};
```

## 配置参数说明

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| points | Number | 1000 | 时间窗口内允许的最大请求次数 |
| duration | Number | 1000 | 时间窗口大小，使用内存存储时单位为毫秒，使用 Redis 时单位为秒 |
| redis | Object | null | Redis 配置对象，为 null 时使用内存存储 |

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
  duration: 60,  // 秒（使用 Redis）
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
  duration: 1,  // 秒（使用 Redis）
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
  duration: 1000,  // 毫秒（使用内存）
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

| 存储方式 | 优点 | 缺点 | 适用场景 |
| --- | --- | --- | --- |
| **内存** | 速度快，无需额外服务 | 重启丢失，单机限流 | 开发环境、单机部署 |
| **Redis** | 持久化，分布式共享 | 需要 Redis 服务 | 生产环境、集群部署 |

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
config.proxy = true;  // 启用代理模式，信任 X-Forwarded-For
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
  package: 'ruoyi-eggjs-ratelimiter',
};

// config/config.prod.js
exports.ratelimiter = {
  points: 100,        // 每分钟 100 次请求
  duration: 60,       // 60 秒
  redis: {
    port: 6379,
    host: '127.0.0.1',
    password: '',
    db: 0,
  },
};

// config/config.local.js
exports.ratelimiter = {
  points: 1000,       // 开发环境宽松限制
  duration: 1000,     // 每秒 1000 次
  redis: null,        // 使用内存存储
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

## 相关链接

- [rate-limiter-flexible 文档](https://github.com/animir/node-rate-limiter-flexible)
- [HTTP 429 状态码说明](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Status/429)

---

## 关于 ruoyi-eggjs 项目

本插件是 [ruoyi-eggjs](https://github.com/undsky/ruoyi-eggjs) 项目的核心组件之一。

**ruoyi-eggjs** 是一个基于 Egg.js 的企业级后台管理系统，参照若依（RuoYi）架构设计，提供完善的权限管理、用户管理、系统监控等功能，是快速开发企业级应用的最佳选择。

### 主要特性

- 🎯 **完整的权限系统**：基于 RBAC 的权限控制，支持细粒度权限管理
- 🚀 **开箱即用**：集成常用功能模块，快速启动项目开发
- 🔧 **MyBatis 风格**：采用 XML 风格的 SQL 编写，熟悉的开发体验
- 📦 **模块化设计**：松耦合的插件体系，按需使用
- 🛡️ **企业级安全**：XSS 防护、SQL 注入防护、访问控制等
- 📊 **系统监控**：在线用户、登录日志、操作日志、定时任务等

### 项目地址

- GitHub: [https://github.com/undsky/ruoyi-eggjs](https://github.com/undsky/ruoyi-eggjs)
- Gitee: [https://gitee.com/undsky/ruoyi-eggjs](https://gitee.com/undsky/ruoyi-eggjs)

### 相关插件

- [ruoyi-eggjs-cache](https://github.com/undsky/ruoyi-eggjs-cache) - 缓存插件
- [ruoyi-eggjs-mybatis](https://github.com/undsky/ruoyi-eggjs-mybatis) - MyBatis 集成
- [ruoyi-eggjs-mysql](https://github.com/undsky/ruoyi-eggjs-mysql) - MySQL 连接
- [ruoyi-eggjs-ratelimiter](https://github.com/undsky/ruoyi-eggjs-ratelimiter) - 限流插件
- [ruoyi-eggjs-sqlite](https://github.com/undsky/ruoyi-eggjs-sqlite) - SQLite 支持
- [ruoyi-eggjs-handlebars](https://github.com/undsky/ruoyi-eggjs-handlebars) - Handlebars 模板

### 联系方式

- 📮 **Issues**: [提交问题或建议](https://github.com/undsky/ruoyi-eggjs/issues)
- 🌐 **官网**: [https://www.undsky.com](https://www.undsky.com)
- 💬 **讨论**: [GitHub Discussions](https://github.com/undsky/ruoyi-eggjs/discussions)

### 贡献指南

欢迎提交 Issue 和 Pull Request！

如果这个项目对你有帮助，请给我们一个 ⭐️ Star 支持一下！

---

## License

[MIT](LICENSE)
