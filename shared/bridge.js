/**
 * 橱窗壳子 ↔ 静态站 的数据桥客户端（可选）。
 * 单独打开 GitHub Pages / 本地静态站时不会启用，页面继续用 WORLD_MOCK。
 *
 * 协议（与 showcase-shell.html 对称）：
 *   → we-query-view { id, viewId, params, options }
 *   ← we-query-view-result { id, ok, result|error }
 *   → we-watch-view { watchId, viewId, params, options }
 *   ← we-watch-view-ready / we-watch-view-result
 *
 * 面板真正热更新前，先用 queryBackgroundWorld() 做一次性拉取验证即可。
 */
(function (global) {
  'use strict';

  const VIEW_ID = 'bg_world_structured_v09';
  let seq = 0;
  const pending = new Map();
  let bridgeParent = null;

  function findBridge() {
    if (bridgeParent) return bridgeParent;
    // 壳子在上两层：shell → index → page
    const candidates = [];
    try { if (global.parent && global.parent !== global) candidates.push(global.parent); } catch (_e) {}
    try { if (global.parent && global.parent.parent && global.parent.parent !== global) candidates.push(global.parent.parent); } catch (_e) {}
    try { if (global.top && global.top !== global) candidates.push(global.top); } catch (_e) {}
    bridgeParent = candidates[candidates.length - 1] || null;
    return bridgeParent;
  }

  function inShell() {
    try {
      return !!(global.top && global.top !== global && global.top.AcuData);
    } catch (_e) {
      // 跨域：看不见 top.AcuData，但仍可能是壳子嵌套
      return !!(global.parent && global.parent !== global);
    }
  }

  function call(type, payload) {
    const target = findBridge();
    if (!target || typeof target.postMessage !== 'function') {
      return Promise.reject(new Error('no bridge'));
    }
    const id = 'q' + (++seq);
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      target.postMessage(Object.assign({ type, id }, payload || {}), '*');
      setTimeout(() => {
        if (!pending.has(id)) return;
        pending.delete(id);
        reject(new Error('bridge timeout'));
      }, 8000);
    });
  }

  global.addEventListener('message', (e) => {
    const msg = e && e.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'we-query-view-result' && msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.result);
      else p.reject(new Error(msg.error || 'query failed'));
    }
  });

  async function queryBackgroundWorld() {
    const result = await call('we-query-view', { viewId: VIEW_ID, params: {} });
    const data = result && result.data;
    if (data && data.background_world) return data.background_world;
    if (data) return data;
    return null;
  }

  global.WE_BRIDGE = {
    VIEW_ID,
    inShell,
    queryBackgroundWorld,
  };
})(window);
