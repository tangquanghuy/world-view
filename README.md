# 后台世界引擎面板

异步助手配置方案的远程展示前端。

线上地址：<https://tangquanghuy.github.io/world-view/>

## 数据链

```text
副 API：bg_world_tick_v12（v1.1 / v1.0 方案是 bg_world_tick_v11 / _v10）
  → 补丁合并进 8 张持久表
  → dataView：bg_world_structured_v12 / _v11 / _v10（英文原始键）
  → 橱窗壳：window.top.AcuData.watchView
  → postMessage 跨域桥
  → index.html 注入真实数据
  → 四个展示页
```

`index.html` 同时订阅四个视图，按 v1.2 > v1.1 > v1.0 > v0.9 取有数据的那个。
v1.1、v1.2 只改了字段说明和提示词，数据形状和 v1.0 相同；v0.9（`bg_world_structured_v09`）的数据先转成 v1.0 形状再交给页面
（并掉的字段并进保留字段，各实体的痕迹与近期变化并进 `changes`）。四个页面只认 v1.0 形状。

本仓库**不包含 mock 数据**。直接访问 GitHub Pages 只会提示从异步助手橱窗打开；
导入配套配置方案后，橱窗才会展示当前数据库中的真实世界状态。

## 入口与路由

- `index.html#/overview`：世界演进
- `index.html#/characters`：角色管理
- `index.html#/factions`：势力与地区
- `index.html#/tasks`：任务与剧本
- `showcase-shell.html`：写入配置方案 `showcaseHtml` 的跨域数据壳

## 本地开发

```bash
npx --yes serve -l 5500 .
node _tools/smoke-spa.cjs http://localhost:5500/ mock/world-state-v10.json
node _tools/smoke-spa.cjs http://localhost:5500/ mock/world-state-v09.json
```

冒烟测试使用测试进程内的结构化 fixture 模拟 `AcuData.watchView`，fixture 不会被页面加载。
fixture 是 `AcuData.queryView` 的整份结果（带 `viewId`），假壳只回应这个视图，用来分别验证 v1.0 与 v0.9 两条路。
`mock/` 被 .gitignore 忽略，需要时从异步助手工程导出。

## 发布

推送 `main` 后由 GitHub Pages 发布。修改 `showcase-shell.html` 后，还要在异步助手工程中重新
运行 `_tools/inject-showcase.cjs`，把壳子写回配置方案。
