/**
 * 架空历法时间的解析与比较。
 *
 * 后台产出的时间形如「霜月12日 22:00」，world_state.world_time 会多带年份，
 * 形如「王历312年霜月12日 22:00」。这不是标准日期，Date 解析不了，
 * 但面板要按时间排序，所以需要一个能比大小的解析器。
 *
 * 已知限制：月份是名字（霜月）不是序号，数据里也没有历法的月份序列，
 * 所以跨月排序只能靠"先见到的月份算更早"这种近似。同月内完全准确。
 * 根治办法是在副 API 的提示词里规定时间格式，见 数据层待办.md。
 */
(function (global) {
  'use strict';

  // 月份名出现顺序，作为跨月比较的兜底依据
  const monthOrder = new Map();
  const monthIndex = (name) => {
    if (!monthOrder.has(name)) monthOrder.set(name, monthOrder.size);
    return monthOrder.get(name);
  };

  /** 一天之内的粗略时段，用于「霜月12日 夜」这种没有具体钟点的写法 */
  // 长词在前：「深夜」含「夜」，「中午」「午后」都不能被更短的词先截走
  const DAYPART = { 凌晨: 3, 黎明: 5, 拂晓: 5, 清晨: 6, 早晨: 7, 上午: 9, 正午: 12, 中午: 12, 午间: 12, 午后: 14, 下午: 15,
                    傍晚: 18, 黄昏: 18, 深夜: 23, 半夜: 23, 夜间: 21, 夜晚: 21, 夜: 21 };

  /**
   * 解析成可比较的数值。解析不出来返回 null，调用方自行决定怎么排。
   * 数值本身没有物理含义，只保证同一套数据内可比。
   */
  function parse(s) {
    const str = String(s || '').trim();
    if (!str) return null;

    // 月份既可能是名字（霜月），也可能是序号（12月）。原来只认名字，
    // 「11月28日」会被读成「月28日」、排到「12月3日」后面去。
    const m = str.match(/(?:(\d+)\s*年)?\s*(?:(\d{1,2})|([^\d\s]{1,4}?))?月\s*(\d+)\s*日/);
    if (!m) return null;

    const year = m[1] ? Number(m[1]) : 0;
    const month = m[2] ? Number(m[2]) : m[3] ? monthIndex(m[3]) : 0;
    const day = Number(m[4]);

    let minutes = -1;                                   // 没有钟点时排在当天最前
    const hhmm = str.match(/(\d{1,2}):(\d{2})/);
    if (hhmm) minutes = Number(hhmm[1]) * 60 + Number(hhmm[2]);
    else for (const [word, hour] of Object.entries(DAYPART)) if (str.includes(word)) { minutes = hour * 60; break; }

    // 一个月按 32 天进位（日最大 31，不会跟下个月撞上）。原来按 64 天进位，
    // 排序一样对，可两个时间点的差值也要拿去画时间尺：跨一次月（11月28日 → 12月3日）
    // 就被算成 39 天，当月那几天全挤在尺子最右一小截，刻度互相让位只剩两枚。
    return ((year * 64 + month) * 32 + day) * 1500 + (minutes + 1);
  }

  /** 倒序比较器：时间新的排前面，解析不出来的沉到最后 */
  function byNewest(get) {
    const key = typeof get === 'function' ? get : (x) => x[get];
    return (a, b) => {
      const va = parse(key(a)), vb = parse(key(b));
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return vb - va;
    };
  }

  /** 这批时间里最晚的一个原值，取不到时返回空串 */
  function latest(list, get) {
    const key = typeof get === 'function' ? get : (x) => x[get];
    let best = null, bestV = null;
    for (const x of list || []) {
      const raw = key(x), v = parse(raw);
      if (v === null) continue;
      if (bestV === null || v > bestV) { bestV = v; best = raw; }
    }
    return best || '';
  }

  global.WTime = { parse, byNewest, latest };
})(window);
