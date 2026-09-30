# 京都大阪六日行程地图

面向手机使用的 2026 年 10 月京都—大阪六日行程。页面按 D1–D6 展示当天地图、路线顺序、时间线、交通提示、票务提醒及外部导航。

## 本地预览

需要 Node.js 20 或更高版本，以及 Python 3。

```bash
npm test
npm run serve
```

如果本机使用 pnpm，也可以运行 `pnpm test` 和 `pnpm run serve`。打开 `http://localhost:8000/` 即可预览。

## 修改地点或时间

所有行程内容集中在 `itinerary-data.js`：

- 每一天是 `ITINERARY_DAYS` 中的一个对象。
- `stops` 控制时间线内容；每个地点使用稳定的 `id`。
- `coordinates` 格式为 `[纬度, 经度]`。不确定坐标时应省略，不要猜测。
- `route` 决定时间线与地图路线顺序，也可以包含没有坐标的交通段。
- `status` 用于“备选・未购票”“暂定时间”等重要提醒。
- `officialUrl`、`ticketUrl` 和 `navigationUrl` 只使用 `https://` 链接。

修改后先运行 `npm test`，确认六日数据顺序、链接、路线和静态文件仍然有效，再提交并推送。

## 隐私边界

这是公开的 GitHub Pages 网站。可以保存酒店名称、公共景点、公共交通和旅行日期，但不要加入：

- 家庭地址或实时位置；
- 护照、证件、订单号或房间号；
- 电话号码、账户信息或付款信息。

## GitHub Pages

网站不需要构建，直接从默认分支根目录发布：

1. 在仓库设置中打开 **Pages**。
2. Source 选择 **Deploy from a branch**。
3. Branch 选择默认分支，目录选择 `/ (root)`。
4. 保存后等待 GitHub 返回公开网址。

Leaflet JavaScript 从官方 CDN 加载；关键地图布局样式已保存在 `leaflet-base.css`。若地图脚本或瓦片临时不可用，文字行程和导航链接仍可独立使用。
