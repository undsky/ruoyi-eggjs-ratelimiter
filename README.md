# egg-psyduck-ratelimiter

> Egg plugin for ratelimiter

## 安装

```bash
$ npm i egg-psyduck-ratelimiter --save
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
  package: "egg-psyduck-ratelimiter",
};
```

## 配置

```js
// {app_root}/config/config.default.js
config.ratelimiter = {
  points: 1000,
  duration: 1000,
  redis: null,
};
```

## 示例

## License

[MIT](LICENSE)
