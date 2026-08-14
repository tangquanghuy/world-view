# 后台世界引擎面板

异步助手配置方案的远程展示前端。

线上地址：<https://tangquanghuy.github.io/world-view/>

## 数据链

```text
副 API：bg_world_tick_v09
  → dataWrites 写入 8 张持久表
  → dataView：bg_world_structured_v09（英文原始键）
  → 橱窗壳：window.top.AcuData.watchView
  → postMessage 跨域桥
  → index.html 注入真实数据
  → 四个展示页
```

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
node _tools/smoke-spa.cjs http://localhost:5500/
```

冒烟测试使用测试进程内的结构化 fixture 模拟 `AcuData.watchView`，fixture 不会被页面加载。

## 发布

推送 `main` 后由 GitHub Pages 发布。修改 `showcase-shell.html` 后，还要在异步助手工程中重新
运行 `_tools/inject-showcase.cjs`，把壳子写回配置方案。
