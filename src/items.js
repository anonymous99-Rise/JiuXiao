/* ============================================================
 * 装备系统：随机词缀 / 稀有度 / 套装 / 属性汇总 / 提示框
 * ============================================================ */

let ITEM_UID = 1;

const UNIQUES = {
  weapon: [
    { name: '斩月·霜寒', power: 'frost', desc: '攻击有 25% 几率使敌人减速 40%，持续 2 秒。', stats: { crit: 6, critDmg: 25 }, cls: 'warrior' },
    { name: '焚天·赤霄', power: 'explode', desc: '击杀敌人时引发一次火焰爆炸。', stats: { atkPct: 12, skillDmg: 15 }, cls: 'mage' },
    { name: '太初·无相', power: 'thunder', desc: '攻击有 18% 几率召下连锁天雷。', stats: { int: 12, cdr: 8 }, cls: 'taoist' }
  ],
  helm: [{ name: '九幽面纱', power: 'vampire', desc: '生命偷取额外 +5%。', stats: { hp: 60, crit: 4 } }],
  chest: [{ name: '玄冥战衣', power: 'thorns', desc: '受到攻击时反弹 30% 伤害。', stats: { def: 40, hp: 100 } }],
  boots: [{ name: '踏云履', power: 'speed', desc: '移动速度额外 +8%。', stats: { moveSpd: 8 } }],
  ring: [{ name: '轮回之戒', power: 'lifesteal', desc: '所有伤害的 6% 转化为生命。', stats: { lifesteal: 6, crit: 4 } }],
  amulet: [{ name: '天机玉珏', power: 'magicfind', desc: '奇遇机缘 +30%。', stats: { magicFind: 30 } }]
};

function tierIndex(ilvl) { return CLAMP(Math.floor((ilvl - 1) / 8), 0, 4); }

function itemPower(item) {
  let s = 0;
  for (const a of item.affixes) s += a.val * (STATS[a.key].pct ? 1.6 : 0.5);
  if (item.baseDmg) s += (item.baseDmg[0] + item.baseDmg[1]) * 1.4;
  if (item.baseArmor) s += item.baseArmor * 0.9;
  return Math.round(s + item.ilvl * 4);
}

function itemValue(item) {
  const r = { common: 1, magic: 1.8, rare: 3, legendary: 6, set: 5 }[item.rarity];
  return Math.round((12 + item.ilvl * 8) * r * (1 + item.affixes.length * 0.15));
}

function affixValue(a, ilvl) {
  const v = RND(a.min, a.max) * (1 + ilvl * 0.055);
  return Math.max(1, Math.round(v));
}

function makeAffix(ilvl, used) {
  let pool = AFFIXES.filter(a => !used.has(a.key));
  const roll = Math.random();
  const tierWant = roll < 0.62 ? 1 : (roll < 0.9 ? 2 : 3);
  let cand = pool.filter(a => a.tier === tierWant);
  if (!cand.length) cand = pool;
  const a = PICK(cand);
  used.add(a.key);
  return { key: a.key, val: affixValue(a, ilvl), pre: a.pre, suf: a.suf, tier: a.tier };
}

function affixText(a) {
  const s = STATS[a.key];
  return '+' + a.val + (s.pct ? '%' : '') + ' ' + s.label;
}

function baseTierFor(slot, ilvl) {
  const ti = tierIndex(ilvl);
  if (slot === 'weapon') return ti;
  return ti;
}

/* 生成一件装备 */
function rollItem(ilvl, opts = {}) {
  ilvl = CLAMP(Math.round(ilvl), 1, 40);
  const slot = opts.slot || PICK(['helm', 'chest', 'shoulders', 'gloves', 'boots', 'belt', 'amulet', 'ring', 'weapon', 'offhand']);
  const cls = opts.cls || PICK(['warrior', 'mage', 'taoist']);
  let rarity = opts.rarity;
  if (!rarity) {
    const mf = opts.magicFind || 0;
    const w = [
      ['common', RARITY.common.weight],
      ['magic', RARITY.magic.weight + mf * 0.16],
      ['rare', RARITY.rare.weight + mf * 0.1],
      ['legendary', RARITY.legendary.weight + mf * 0.05],
      ['set', RARITY.set.weight + mf * 0.04]
    ];
    let total = w.reduce((s, x) => s + x[1], 0), r = Math.random() * total;
    for (const [k, v] of w) { if (r < v) { rarity = k; break; } r -= v; }
    if (!rarity) rarity = 'common';
  }
  const isRing = slot === 'ring';
  const item = {
    uid: ITEM_UID++, slot, ilvl, rarity, cls: null, affixes: [],
    setId: null, setName: null, power: null, powerDesc: null, reqLv: Math.max(1, ilvl - 1)
  };

  /* ---- 基底 ---- */
  if (slot === 'weapon') {
    const list = WEAPON_BASES[cls];
    const bi = CLAMP(tierIndex(ilvl), 0, list.length - 1);
    const base = list[bi];
    const rm = RARITY[rarity].mul;
    const lo = base.dmg[0] * (1 + ilvl * 0.115) * rm;
    const hi = base.dmg[1] * (1 + ilvl * 0.115) * rm;
    item.baseName = base.name;
    item.shape = base.shape;
    item.baseDmg = [Math.round(lo), Math.round(hi)];
    item.speed = base.speed;
    item.cls = cls;
    item.name = base.name;
    item.kind = '武器';
  } else if (slot === 'offhand') {
    const list = OFFHAND_BASES[cls];
    const bi = CLAMP(tierIndex(ilvl), 0, list.length - 1);
    const [bn, barm] = list[bi];
    item.baseName = bn;
    item.baseArmor = Math.round(barm * (1 + ilvl * 0.1) * RARITY[rarity].mul);
    item.cls = cls;
    item.name = bn;
    item.kind = '副手';
    item.shape = cls === 'warrior' ? 'shield' : (cls === 'mage' ? 'orb' : 'charm');
  } else {
    const list = ARMOR_BASES[slot];
    const bi = CLAMP(tierIndex(ilvl), 0, list.length - 1);
    const [bn, barm] = list[bi];
    item.baseName = bn;
    item.baseArmor = Math.round(barm * (1 + ilvl * 0.13) * RARITY[rarity].mul);
    item.name = bn;
    item.kind = SLOTS[slot].name;
  }
  if (isRing) { item.slot = 'ring'; }

  /* ---- 套装 ---- */
  if (rarity === 'set') {
    const cands = Object.values(SETS).filter(s =>
      (!s.cls || s.cls === cls) &&
      s.slots.some(sl => sl === slot || (sl === 'ring' && slot === 'ring'))
    );
    if (cands.length) {
      const set = PICK(cands);
      const idx = set.slots.findIndex(sl => sl === slot);
      const pieceIndex = idx >= 0 ? idx : set.slots.findIndex(sl => sl === 'ring');
      item.setId = set.id;
      item.setName = set.name;
      item.name = set.pieces[pieceIndex] || set.pieces[0];
      item.rarity = 'set';
      item.cls = set.cls || null;
    } else rarity = item.rarity = 'rare';
  }

  /* ---- 唯一神兵 ---- */
  if (item.rarity === 'legendary' && !item.setId && CHANCE(0.55)) {
    const pool = (UNIQUES[slot] || []).filter(u => !u.cls || u.cls === cls);
    if (pool.length) {
      const u = PICK(pool);
      item.name = u.name;
      item.power = u.power;
      item.powerDesc = u.desc;
      item.uniqueStats = u.stats || {};
      item.cls = cls;
    }
  }

  /* ---- 词缀 ---- */
  let count = RARITY[item.rarity].affixes;
  if (item.rarity === 'rare' && CHANCE(0.5)) count = 4;
  if (item.rarity === 'set') count = 3 + (CHANCE(0.4) ? 1 : 0);
  const used = new Set();
  for (let i = 0; i < count; i++) item.affixes.push(makeAffix(ilvl, used));

  /* ---- 命名 ---- */
  if (!item.setId && !item.power) {
    if (item.rarity === 'magic') {
      const a = item.affixes[0];
      item.name = (CHANCE(0.5) ? PICK(a.pre) : '') + item.baseName + (CHANCE(0.35) ? PICK(a.suf).replace(/^·\s*/, '·') : '');
    } else if (item.rarity === 'rare') {
      const p = item.affixes[0], s = item.affixes[1] || p;
      item.name = PICK(p.pre) + item.baseName + PICK(s.suf).replace(/^·\s*/, '·');
    } else if (item.rarity === 'legendary') {
      item.name = PICK(['灭世', '焚寂', '太虚', '九幽', '斩龙', '无相']) + '·' + item.baseName;
    }
  }
  item.value = itemValue(item);
  return item;
}

/* 初始装备 */
function makeStarterSet(cls) {
  const w = rollItem(1, { slot: 'weapon', cls, rarity: 'common' });
  w.name = { warrior: '新兵铁剑', mage: '旧桃木杖', taoist: '师父的桃木剑' }[cls];
  w.affixes = [{ key: 'atk', val: 3, pre: [], suf: [], tier: 1 }];
  return { weapon: w, chest: rollItem(1, { slot: 'chest', cls, rarity: 'common' }) };
}

/* ---------------- 属性汇总 ---------------- */
function emptyStats() {
  const o = {};
  for (const k in STATS) o[k] = 0;
  return o;
}

function sumItemStats(item, out) {
  if (item.baseDmg) out.atk += (item.baseDmg[0] + item.baseDmg[1]) / 2;
  if (item.baseArmor) out.def += item.baseArmor;
  for (const a of item.affixes) out[a.key] = (out[a.key] || 0) + a.val;
  if (item.uniqueStats) for (const k in item.uniqueStats) out[k] = (out[k] || 0) + item.uniqueStats[k];
  if (item.power === 'vampire') out.lifesteal += 5;
  if (item.power === 'speed') out.moveSpd += 8;
  if (item.power === 'thorns') out.thorns += 30;
  if (item.power === 'lifesteal') out.lifesteal += 6;
  if (item.power === 'magicfind') out.magicFind += 30;
}

function aggregate(equipped) {
  const st = emptyStats();
  const setCount = {};
  const flags = {};
  for (const slot in equipped) {
    const it = equipped[slot];
    if (!it) continue;
    sumItemStats(it, st);
    if (it.setId) setCount[it.setId] = (setCount[it.setId] || 0) + 1;
    if (it.power) flags[it.power] = true;
  }
  const setBonuses = [];
  for (const sid in setCount) {
    const set = SETS[sid];
    for (const b of set.bonuses) {
      if (setCount[sid] >= b.need) {
        setBonuses.push({ setId: sid, name: set.name, text: b.text, need: b.need });
        if (b.stats) for (const k in b.stats) st[k] = (st[k] || 0) + b.stats[k];
        if (b.flag) flags[b.flag] = true;
      }
    }
  }
  return { stats: st, setCount, setBonuses, flags };
}

/* 计算玩家最终属性 */
function computePlayerStats(p) {
  const agg = aggregate(p.equipment);
  const st = agg.stats;
  const c = CLASSES[p.cls];
  const lv = p.level;
  const str = c.base.str + c.growth.str * (lv - 1) + st.str;
  const agi = c.base.agi + c.growth.agi * (lv - 1) + st.agi;
  const vit = c.base.vit + c.growth.vit * (lv - 1) + st.vit;
  const int = c.base.int + c.growth.int * (lv - 1) + st.int;
  const main = { str, agi, vit, int }[c.mainStat];

  const atk = (c.baseAtk + st.atk + main * c.statMul) * (1 + st.atkPct / 100);
  const hpMax = (c.baseHp + lv * 16 + vit * c.hpPerVit + st.hp) * (1 + st.hpPct / 100);
  const mpMax = c.baseMp + lv * 4 + int * c.mpPerInt + st.mp;
  const crit = CLAMP(5 + agi * 0.18 + st.crit, 0, 75);
  const critDmg = 150 + st.critDmg;
  const aspd = (1 + st.aspd / 100) * (1 + agi * 0.004);
  const moveSpd = (7.2 + agi * 0.015) * (1 + st.moveSpd / 100);
  const def = st.def + vit * 0.6;
  const cdr = CLAMP(st.cdr, 0, 45);

  return {
    str, agi, vit, int, atk, hpMax: Math.round(hpMax), mpMax: Math.round(mpMax),
    crit, critDmg, aspd, moveSpd, def, cdr,
    lifesteal: st.lifesteal, skillDmg: st.skillDmg, allRes: st.allRes,
    goldFind: st.goldFind, magicFind: st.magicFind, killHeal: st.killHeal,
    mpReg: 3 + st.mpReg, thorns: st.thorns, summonDmg: st.summonDmg,
    setBonuses: agg.setBonuses, setCount: agg.setCount, flags: agg.flags, raw: st
  };
}

/* ---------------- 提示框 ---------------- */
const SLOT_NAME = { helm: '头盔', chest: '战甲', shoulders: '护肩', gloves: '护手', boots: '战靴', belt: '腰带', amulet: '项链', ring: '戒指', ring1: '戒指', ring2: '戒指', weapon: '武器', offhand: '副手' };

function itemTooltip(item, opts = {}) {
  if (!item) return '';
  const r = RARITY[item.rarity];
  let h = `<div class="tt" style="--rc:${r.color}">`;
  h += `<div class="tt-name" style="color:${r.color}">${item.name}</div>`;
  h += `<div class="tt-sub">${r.name} · ${SLOT_NAME[item.slot] || item.kind}${item.setName ? ' · ' + item.setName + '套装' : ''}</div>`;
  if (item.baseDmg) {
    const dps = ((item.baseDmg[0] + item.baseDmg[1]) / 2 / (item.speed || 1)).toFixed(1);
    h += `<div class="tt-main">攻击 ${item.baseDmg[0]} - ${item.baseDmg[1]}　<span class="dim">速度 ${(item.speed || 1).toFixed(2)}　DPS ${dps}</span></div>`;
  }
  if (item.baseArmor) h += `<div class="tt-main">护甲 ${item.baseArmor}</div>`;
  if (!item.baseDmg && !item.baseArmor) h += `<div class="tt-main dim">饰品</div>`;
  for (const a of item.affixes) {
    h += `<div class="tt-aff">${affixText(a)}</div>`;
  }
  if (item.powerDesc) h += `<div class="tt-power">神兵特效：${item.powerDesc}</div>`;
  if (item.setId) {
    const set = SETS[item.setId];
    const have = (Game.state ? (Game.state.setCount[item.setId] || 0) : 0);
    h += `<div class="tt-set"><div class="tt-set-t" style="color:${set.color}">${set.name}（${have}/${set.pieces.length}）</div>`;
    for (const b of set.bonuses) {
      const on = have >= b.need;
      h += `<div class="tt-set-b ${on ? 'on' : 'off'}">(${b.need}) ${b.text}</div>`;
    }
    h += `</div>`;
  }
  h += `<div class="tt-req">需求等级 ${item.reqLv}${item.cls ? ' · ' + CLASSES[item.cls].name : ''}</div>`;
  h += `<div class="tt-val">售价 ${item.value} 金</div>`;
  if (opts.hint) h += `<div class="tt-hint">${opts.hint}</div>`;
  h += `</div>`;
  return h;
}
