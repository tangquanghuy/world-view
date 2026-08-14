# 共享层 · 角色档案页（第三轮）

这一轮的题目是「按人的事 / 系统的事重排，措辞再过一遍」。
上一轮记在这儿的六条，`field-coverage.cjs` 的字段组和 `field-audit.cjs` 的
「先点开浮层再抓文本 / `--no-attrs`」都已经落地了，本轮不再重复。
浮层内部骨架（`.sheet-head` / `.sheet-grid` / `.sheet-cols` / `.sheet-sec`）
按交代**这轮没搬**，等拓扑图那边收工统一并。

---

## 一、已经改了的：`shared/vocab.js`，五个标签

这五个都不是「译得不够漂亮」，是**词本身在中文里指的是另一件事**，
玩家读到会想歪，而且这几组词在总览页也在用。改的是标签，枚举键一个没动。

| 组 | 键 | 改前 | 改后 | 为什么 |
| --- | --- | --- | --- | --- |
| `npc.presence` | `foreground` | 前台 | **在眼前** | 契约管这块叫「前台接口」，直译成「前台」上了台面是接待柜台的意思。这一组说的是「此刻离玩家有多近」，所以整组按距离说话 |
| `npc.presence` | `nearby` | 邻近 | **在附近** | 跟上一条配平，「邻近」是书面语 |
| `candidate.status` | `ready` | 可启用 | **可以登场** | 「启用」是开关功能的说法，说的却是一个还没登场的人 |
| `candidate.status` | `retired` | 已弃用 | **不再考虑** | 「弃用」是废弃接口的说法 |
| `state.status` | `idle` | 闲置 | **没事做** | 「闲置」是说物件的 |

没动的两个borderline：`dormant`「休眠」和 `retired`「已退场」。
「休眠」确实是机器的词，但换成「暂时搁下」「久未露面」都各有偏差，
换不比不换清楚；「已退场」本来就是戏台上的话。

**影响面**：`npc.presence` 和 `candidate.status` 在 `角色档案.html` 与 `总览.html`
两页出现（人物名册的状态角标、档案主卡名字旁的胶囊、总览的人物卡）。
名册卡是 224px 宽，「在附近」比「邻近」多一个字，实测没折行。

## 二、建议进 `console.css`：`.sysmore`（虚线出口）

```css
.rail-sys{display:flex;justify-content:center;padding:2px 0 0}
.sysmore{
  margin:0;padding:7px 13px;border:1px dashed var(--rule);border-radius:var(--r-chip);
  background:transparent;color:var(--ink4);font:14px/1.4 var(--ui);
}
.sysmore:hover{background:transparent;color:var(--ink2);border-color:var(--ink5)}
```

`.dmore` 是「这一节还有更多，进去看」，`.sysmore` 是「这块东西不是给你看的，
但没藏起来」。虚线跟 `.ghost` 同一套语汇（实线＝有内容，虚线＝这里的东西不在这儿）。
另外三页只要有「产出了但玩家用不上」的字段块就会需要它——
势力页的 `next_update`、任务页的 `change_key` 一族大概是同一类。
现在只有本页在用，按 README 的判据（第二个页面真的要用时再提）先放这儿。

同族的 `.sheet-sec.sys`（浮层里那一节压一档：外框虚线、标题不上主色）
跟浮层骨架一起搬比较合适，等骨架那件事一起做。

## 三、观察到的数据层问题（不是共享层的事，记一笔）

`candidate_updates.profile` 里 `occupation` 和 `social_role` 在契约里是两个问题
（「当前主要职业或工作身份」／「职业、谋生身份和当地社会位置」），
mock 里露西两条都填了「代写员」，页面上就是并排两格同一个值。

按 README 的规矩没有藏掉任何一条（`first()` 那套毛病），只把标签分成
「职业」和「社会角色」让人看出是两个问题。但如果副 API 实际产出也总是撞值，
那这两个字段该合成一个——建议在 `数据层待办.md` 里跟 `scene_entry` / `retention`
那两条排在一起，都是「产出了但没增量」的字段。
