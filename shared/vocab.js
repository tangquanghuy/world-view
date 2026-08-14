/**
 * 枚举词典 —— 四个面板页共用的唯一中文标签来源。
 *
 * 每一组都对应 后台世界引擎-三类演进版-v0.9.json 字段契约里的一条枚举约束，
 * 组名后的注释即契约原文位置。改词典前先核对契约，不要凭感觉加值。
 *
 * 用 V.label(组名, 值) 取标签：遇到契约外的值会在控制台告警并原样返回，
 * 让契约漂移暴露出来，而不是把英文枚举默默渲染给用户看。
 */
(function (global) {
  'use strict';

  const DICT = {
    /* ---------------- 任务 task_updates ---------------- */

    // 契约：只使用 main_task、side_task、character_task、faction_project、personal_task、other；
    //      只有输入明确时区分主线和支线。
    // 后台自主演进出的任务不得自称主线/支线，这两项只在上游明确归类时才会出现。
    'task.category': {
      main_task: '主线任务',
      side_task: '支线任务',
      character_task: '角色任务',
      faction_project: '势力项目',
      personal_task: '个人事务',
      other: '其他事项',
    },

    // 契约：只使用 available、active、waiting、blocked、completed、failed、cancelled。
    'task.status': {
      available: '可承接',
      active: '进行中',
      waiting: '待回应',
      blocked: '受阻',
      completed: '已完成',
      failed: '已失败',
      cancelled: '已取消',
    },

    // 契约：只使用 completed、current、available、waiting、blocked、cancelled。
    // 注意没有 planned，旧 demo 用错过。
    'stage.status': {
      completed: '已完成',
      current: '进行中',
      available: '可推进',
      waiting: '等待中',
      blocked: '受阻',
      cancelled: '已取消',
    },

    /* ---------------- 事件 event_updates ---------------- */

    // 契约：事件类别，如 conflict、accident、politics…（开放式建议值，非封闭枚举）
    'event.category': {
      conflict: '冲突',
      accident: '事故',
      politics: '政治',
      trade: '商贸',
      disaster: '灾害',
      discovery: '发现',
      social: '社会',
      rumor: '传闻',
      infrastructure: '设施',
      investigation: '调查',
      other: '其他',
    },

    // 契约：只使用 active、waiting、contained、resolved、ended。
    'event.status': {
      active: '进行中',
      waiting: '等待中',
      contained: '已控制',
      resolved: '已解决',
      ended: '已结束',
    },

    /* ---------------- 参与者（任务与事件共用）---------------- */

    // 契约：只使用 person、faction、group、other。
    'participant.type': { person: '人物', faction: '势力', group: '团体', other: '其他' },

    /* ---------------- 人物 npc_updates ---------------- */

    // 契约：只使用 offscreen、nearby、foreground、dormant、retired。
    // 这一组说的是「此刻离玩家有多近」，所以按距离说话。契约原文管 foreground 叫
    // 「前台接口」，直译成「前台」上了台面就是接待柜台的意思，玩家读不到「就在你眼前」。
    'npc.presence': {
      offscreen: '视线外',
      nearby: '在附近',
      foreground: '在眼前',
      dormant: '休眠',
      retired: '已退场',
    },

    // 契约：只使用 working、travelling、meeting、investigating、resting、waiting、recovering、idle、other。
    'state.status': {
      working: '工作中',
      travelling: '赶路中',
      meeting: '会面中',
      investigating: '查证中',
      resting: '休息中',
      waiting: '等待中',
      recovering: '恢复中',
      idle: '空闲中',        // 「闲置」是说物件的，这一栏说的是人；同组都是「X中」，别单独破句式
      other: '其他',
    },

    // 契约：只使用 completed、planned、waiting、cancelled。当前行动只放 current_state。
    // 这里的 planned 是日程表的合法值，与 stage.status 无关，别混。
    'schedule.status': { completed: '已完成', planned: '已安排', waiting: '等待中', cancelled: '已取消' },

    // 契约：只使用 economy、health、energy、time、authority、access、equipment、transport、social、other。
    'condition.category': {
      economy: '经济',
      health: '健康',
      energy: '精力',
      time: '时间',
      authority: '权限',
      access: '准入',
      equipment: '装备',
      transport: '运输',
      social: '社交',
      other: '其他',
    },

    /* ---------------- 认知 knowledge ---------------- */

    // 契约：只使用 witnessed、record、reported、public、rumor、inferred。
    'knowledge.source': {
      witnessed: '亲历',
      record: '文书记录',
      reported: '他人转述',
      public: '公开消息',
      rumor: '传闻',
      inferred: '推断',
    },

    // 契约：只使用 confirmed、uncertain、disputed、outdated。
    'knowledge.status': { confirmed: '已确认', uncertain: '未确证', disputed: '有争议', outdated: '已过时' },

    /* ---------------- 关系 relations ---------------- */

    // 契约：目标类型，只使用 person、faction、region、task、event、other。
    'relation.target': { person: '人物', faction: '势力', region: '地区', task: '任务', event: '事件', other: '其他' },

    // 契约：当前关系类别，如 member、employment…（开放式建议值）
    'relation.type': {
      member: '成员',
      employment: '雇佣',
      family: '亲属',
      friendship: '交情',
      cooperation: '协作',
      trade: '生意往来',
      alliance: '结盟',
      rivalry: '竞争',
      hostility: '敌对',
      debt: '债务',
      service: '效力',
      contact: '联络',
      influence: '影响',
    },

    /* ---------------- 势力 faction_updates ---------------- */

    // 契约：只使用 active、dormant、retired。
    'faction.status': { active: '活跃', dormant: '蛰伏', retired: '已消亡' },

    // 契约：只使用 control、operate、garrison、influence、contested、transit。
    'area.relation': {
      control: '控制',
      operate: '经营',
      garrison: '驻防',
      influence: '影响',
      contested: '争夺中',
      transit: '过境',
    },

    // 契约：只使用 funds、personnel、supplies、transport、information、sites、authority、other。
    'resource.type': {
      funds: '资金',
      personnel: '人手',
      supplies: '物资',
      transport: '运力',
      information: '情报',
      sites: '场所',
      authority: '权限',
      other: '其他',
    },

    /* ---------------- 候选人物 candidate_updates ---------------- */

    // 契约：只使用 observe、ready、dormant、retired。
    // 「可启用」「已弃用」是开关功能和废弃接口的说法，说的却是一个还没登场的人。
    'candidate.status': { observe: '观察中', ready: '可以登场', dormant: '休眠', retired: '不再考虑' },

    /* ---------------- 地区 region_updates ---------------- */

    // 契约：只使用 controlled、shared、contested、unclaimed、unclear。
    // 「通行受限」「秩序被破坏」属于 conditions，不是控制状态。
    'control.status': {
      controlled: '单方控制',
      shared: '共管',
      contested: '争夺中',
      unclaimed: '无归属',
      unclear: '归属不明',
    },

    // 契约：只使用 commerce、order、access、population、infrastructure、supply、travel、weather、other。
    // 地区条件没有 economy，那是人物条件表的值。
    'region.condition': {
      commerce: '商业',
      order: '秩序',
      access: '准入',
      population: '人口',
      infrastructure: '设施',
      supply: '补给',
      travel: '交通',
      weather: '天气',
      other: '其他',
    },

    /* ---------------- 变化索引 change_updates ---------------- */

    // 契约：只使用 task、event、region、relation、effect。
    'change.kind': { task: '任务', event: '事件', region: '地区', relation: '关系', effect: '影响' },

    // 契约：只使用 npc、faction、task、event、region。
    'change.source': { npc: '人物', faction: '势力', task: '任务', event: '事件', region: '地区' },
  };

  const warned = new Set();

  function label(group, value, fallback) {
    const table = DICT[group];
    if (!table) throw new Error(`词典里没有这一组：${group}`);
    if (value === '' || value == null) return fallback ?? '';
    if (value in table) return table[value];
    const key = `${group}=${value}`;
    if (!warned.has(key)) {
      warned.add(key);
      console.warn(`[vocab] "${value}" 不在契约枚举 ${group} 内，请核对 后台世界引擎-三类演进版-v0.9.json`);
    }
    return fallback ?? value;
  }

  /** 任务的 category 是否由上游明确归类。后台自主演进的任务不会是主线或支线。 */
  const isStoryline = (category) => category === 'main_task' || category === 'side_task';

  global.V = { DICT, label, isStoryline };
})(window);
