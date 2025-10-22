/*
 * @Author: 姜彦汐
 * @Date: 2021-03-17 11:45:27
 * @LastEditors: 姜彦汐
 * @LastEditTime: 2021-08-20 16:08:54
 * @Description:
 * @Site: https://www.undsky.com
 */
module.exports = (appInfo) => ({
  ratelimiter: {
    points: 1000,
    duration: 1000,
    redis: null,
  },
});
