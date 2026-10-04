"use strict";
/* ============================================================
   chibi.js：两个 Q 版小人（照着约稿的原画，用代码重画、拆成能动的部件）
   ------------------------------------------------------------
   左：粉发骑士，坐在木椅上，握着粉色杯子；身边一只粉色兔耳小鸟
   右：白发、戴红冠的小人，穿橙色袍子，握着白色杯子；身边一只戴小红冠的白鸟
   平时：呼吸起伏、头微微晃、眨眼、眼睛跟着鼠标、杯子冒热气、偶尔低头喝一口
   碰杯：点小人，或完成任务 / 打卡 / 番茄结束（celebrate）→ 两人举杯一碰，飘出爱心，「叮」
   点小鸟：跳一下、啾一声、冒一颗心
   可以选角色：mode = 'both' 两个一起 / 'A' 只有左边 / 'B' 只有右边（设置页里选）；
   只有一个人时，碰杯改成自己举杯「干杯」，人也放大站到中间
   坐标：先在「原画坐标」（1280×1280 的画面里）里画，再整体缩放平移到舞台中间
   ============================================================ */

const INKC = 'rgb(58,42,40)';
const COL = {
  skin: '#fde8dc', blush: 'rgba(240,150,150,0.28)',
  pinkHair: '#f2a2a9', pinkHairLt: '#f9cdcf', pinkHairDk: '#de8590',
  armor: '#c6cde0', armorDk: '#939dba', armorLt: '#eceff7',
  tunic: '#e0e9a3', tunicDk: '#bccb76',
  wood: '#a9774f', woodDk: '#7f5437', woodLt: '#c99d71',
  mugPink: '#f3a9b2', mugPinkDk: '#d98591', mugWhite: '#fdfdfb', mugWhiteDk: '#d7dbe0',
  whiteHair: '#f5f5f3', whiteHairDk: '#cad1d8',
  red: '#cf413d', redDk: '#a32f2c', crownSide: '#dba57f',
  robe: '#f0a75a', robeDk: '#d9863c', robeIn: '#d6483f', sleeve: '#f7f1df', sleeveDk: '#ddd3b8', ribbon: '#ebaa52',
  pants: '#c3c9bb', boot: '#cd4b44', bootDk: '#9e3631',
  mouth: '#ea7d7e', mouthDk: '#c25556',
  heart: '#e6646d', bunny: '#f4abb6', bunnyDk: '#dd8997', bunnyEar: '#fdf3f3', bird: '#fcfcfa', beak: '#f0b85a',
};
const LW = 3.4;   // 钢笔勾边粗细（原画坐标里）

/* ---------- 画形状的小工具（都在当前变换下，原画坐标） ---------- */
function fs(fill, lw = LW){
  if (fill){ ctx.fillStyle = fill; ctx.fill(); }
  if (lw){ ctx.strokeStyle = INKC; ctx.lineWidth = lw; ctx.stroke(); }
}
function ell(x, y, rx, ry, rot = 0){ ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); }
function smooth(pts, closed = true){   // 过各边中点的二次曲线（圆润的手绘轮廓）
  const n = pts.length;
  ctx.beginPath();
  if (closed){
    ctx.moveTo((pts[n-1][0] + pts[0][0]) / 2, (pts[n-1][1] + pts[0][1]) / 2);
    for (let i = 0; i < n; i++){
      const a = pts[i], b = pts[(i + 1) % n];
      ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    }
    ctx.closePath();
  } else {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n - 1; i++){
      const a = pts[i], b = pts[i + 1];
      ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    }
    ctx.lineTo(pts[n-1][0], pts[n-1][1]);
  }
}
/* 云朵 / 卷发轮廓：沿椭圆一圈向外鼓的小弧 */
function fluffy(cx, cy, rx, ry, n, puff, a0 = 0){
  const P = a => [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  ctx.beginPath();
  const p0 = P(a0); ctx.moveTo(p0[0], p0[1]);
  for (let k = 1; k <= n; k++){
    const am = a0 + (k - 0.5) / n * TAU, p = P(a0 + k / n * TAU);
    ctx.quadraticCurveTo(cx + Math.cos(am) * rx * (1 + puff), cy + Math.sin(am) * ry * (1 + puff), p[0], p[1]);
  }
  ctx.closePath();
}
/* 几块形状合成一块：先全部描粗边，再全部填色 → 只剩外轮廓 */
function union(builders, fill, lw = LW){
  ctx.strokeStyle = INKC; ctx.lineWidth = lw * 2;
  for (const b of builders){ b(); ctx.stroke(); }
  ctx.fillStyle = fill;
  for (const b of builders){ b(); ctx.fill(); }
}
function line(pts, color = INKC, w = LW){ smooth(pts, false); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke(); }
/* 粗胶囊（手臂 / 袖子）：先描墨边再填色 */
function capsule(a, b, w, fill){
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
  ctx.strokeStyle = INKC; ctx.lineWidth = w + LW * 2; ctx.stroke();
  ctx.strokeStyle = fill; ctx.lineWidth = w; ctx.stroke();
}
function heartPath(x, y, s){
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.38);
  ctx.bezierCurveTo(x - s * 1.15, y - s * 0.3, x - s * 0.5, y - s * 1.1, x, y - s * 0.42);
  ctx.bezierCurveTo(x + s * 0.5, y - s * 1.1, x + s * 1.15, y - s * 0.3, x, y + s * 0.38);
  ctx.closePath();
}
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/* 动作的权重曲线：0→1（抬起）→ 保持 → 1→0（放下） */
function envelope(p, up, hold){
  if (p < 0 || p > 1) return 0;
  if (p < up) return ease(p / up);
  if (p < up + hold) return 1;
  return 1 - ease((p - up - hold) / (1 - up - hold));
}

/* 背景那一团水彩（预生成抖动轮廓，固定不闪） */
const washBlob = [];
for (let k = 0, o = 0; k < 28; k++){
  o = o * 0.6 + rnd(-0.05, 0.05);
  const a = k / 28 * TAU;
  washBlob.push([640 + Math.cos(a) * 470 * (1 + o), 625 + Math.sin(a) * 400 * (1 + o)]);
}

/* 三种组合各自占的范围（原画坐标）：中心 x、宽度 */
const CHIBI_MODES = {
  both: { cx: 630, w: 900 },
  A:    { cx: 418, w: 500 },
  B:    { cx: 868, w: 480 },
};

/* ============================================================ */
const Chibi = {
  t: 0,
  mode: 'both',
  ox: 0, oy: 0, s: 1,          // 原画坐标 → 屏幕：screen = o + art * s
  pointer: null,               // 鼠标（屏幕坐标）
  look: { A: [0, 0], B: [0, 0] },
  blink: { A: { at: 1.8, until: 0 }, B: { at: 3.1, until: 0 } },
  sip: { who: null, p: -1 },   // 正在喝茶的是谁、进度 0–1
  nextSip: 6,
  toastP: -1,                  // 碰杯进度 0–1
  clinked: false,
  hearts: [],
  hop: { bunny: -1, bird: -1 },

  /* ---------- 布局：整组居中在舞台可用区域，底部给色板留位置 ---------- */
  layout(){
    const aw = Math.max(240, W - insetR), m = CHIBI_MODES[this.mode];
    const s = Math.min(aw * 0.82 / m.w, (H * 0.47 - 96) / 380, (H * 0.53 - 70) / 390);
    this.s = Math.max(0.15, s);
    this.ox = CX - m.cx * this.s;
    this.oy = H * 0.53 - 600 * this.s;
  },
  has(who){ return this.mode === 'both' || this.mode === who; },
  setMode(m){
    if (!CHIBI_MODES[m] || m === this.mode) return;
    this.mode = m;
    this.sip.p = -1; this.toastP = -1; this.hearts.length = 0;
  },
  toArt(px, py){ return [(px - this.ox) / this.s, (py - this.oy) / this.s]; },

  /* ---------- 互动 ---------- */
  hit(px, py){
    const [x, y] = this.toArt(px, py);
    if (this.has('A') && Math.hypot(x - 285, y - 735) < 60) return 'bunny';
    if (this.has('B') && Math.hypot(x - 985, y - 690) < 62) return 'bird';
    if (this.has('A') && x > 300 && x < 640 && y > 320 && y < 975) return 'A';
    if (this.has('B') && x > 640 && x < 1010 && y > 230 && y < 975) return 'B';
    return null;
  },
  click(px, py){
    const who = this.hit(px, py);
    if (!who) return false;
    if (who === 'bunny' || who === 'bird'){
      this.hop[who] = 0;
      const [x, y] = who === 'bunny' ? [285, 690] : [985, 640];
      this._burst(x, y, 2);
      chirp();
    } else this.toast();
    return true;
  },
  toast(){
    if (this.toastP >= 0 && this.toastP < 0.5) return;   // 正在碰
    this.sip.p = -1;
    this.toastP = 0;
    this.clinked = false;
  },
  _burst(x, y, n){
    for (let i = 0; i < n; i++) this.hearts.push({ x: x + rnd(-14, 14), y: y + rnd(-8, 8), vx: rnd(-30, 30), vy: rnd(-95, -60),
      t: 0, life: rnd(1.3, 1.9), size: rnd(11, 17), ph: rnd(0, TAU) });
  },

  /* ---------- 每帧 ---------- */
  update(dt){
    const t = (this.t += dt);
    // 眨眼：每 2.5–5.5 秒一次，偶尔连眨两下
    for (const k of ['A', 'B']){
      const b = this.blink[k];
      if (t >= b.at){ b.until = t + 0.13; b.at = t + (Math.random() < 0.2 ? 0.28 : rnd(2.5, 5.5)); }
    }
    // 偶尔低头喝一口（两人轮流）
    if (this.sip.p >= 0){ this.sip.p += dt / 2.2; if (this.sip.p > 1) this.sip.p = -1; }
    else if (this.toastP < 0 && t > this.nextSip){
      this.sip = { who: this.mode === 'both' ? (Math.random() < 0.5 ? 'A' : 'B') : this.mode, p: 0 };
      this.nextSip = t + rnd(7, 13);
    }
    // 碰杯：进度到 0.36 时杯子碰上 → 叮 + 爱心
    if (this.toastP >= 0){
      this.toastP += dt / 1.3;
      if (!this.clinked && this.toastP >= 0.36){
        this.clinked = true;
        clink();
        // 两个人：爱心从两只杯子碰在一起的地方冒出来；一个人：从举起的杯子上方
        const at = this.mode === 'both' ? [640, 700] : this.mode === 'A' ? [612, 650] : [674, 650];
        this._burst(at[0], at[1], 6);
      }
      if (this.toastP > 1) this.toastP = -1;
    }
    for (const k of ['bunny', 'bird']) if (this.hop[k] >= 0){ this.hop[k] += dt / 0.55; if (this.hop[k] > 1) this.hop[k] = -1; }
    for (let i = this.hearts.length - 1; i >= 0; i--){
      const p = this.hearts[i];
      p.t += dt; p.x += (p.vx + Math.sin(p.t * 4 + p.ph) * 22) * dt; p.y += p.vy * dt; p.vy *= Math.exp(-dt * 0.6);
      if (p.t > p.life) this.hearts.splice(i, 1);
    }
    // 眼睛跟着鼠标（慢慢转过去）
    const k = Math.min(1, dt * 6);
    for (const [who, ex, ey] of [['A', 554, 634], ['B', 752, 567]]){
      let tx = 0, ty = 0;
      if (this.pointer){
        const [ax, ay] = this.toArt(this.pointer[0], this.pointer[1]);
        const dx = ax - ex, dy = ay - ey, d = Math.hypot(dx, dy) || 1, m = Math.min(5, d / 50);
        tx = dx / d * m; ty = dy / d * m;
      }
      const L = this.look[who];
      L[0] += (tx - L[0]) * k; L[1] += (ty - L[1]) * k;
    }
  },

  draw(){
    this.layout();
    const t = this.t;
    ctx.save();
    ctx.translate(this.ox, this.oy);
    ctx.scale(this.s, this.s);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    // 背景水彩 + 地面影子（跟着当前组合的范围走）
    const w = curWash(), m = CHIBI_MODES[this.mode], sx = m.w / 900;
    ctx.save(); ctx.translate(m.cx, 625); ctx.scale(sx, 1); ctx.translate(-640, -625);
    smooth(washBlob); fs(`rgba(${w[0]|0},${w[1]|0},${w[2]|0},0.42)`, 0);
    ctx.translate(14, 10); smooth(washBlob); fs(`rgba(${w[0]|0},${w[1]|0},${w[2]|0},0.16)`, 0);
    ctx.restore();
    ell(m.cx + 20, 968, 345 * sx, 20); fs('rgba(115,105,100,0.13)', 0);

    const toastW = envelope(this.toastP, 0.32, 0.22);
    const sipA = this.sip.who === 'A' ? envelope(this.sip.p, 0.28, 0.42) : 0;
    const sipB = this.sip.who === 'B' ? envelope(this.sip.p, 0.28, 0.42) : 0;
    const bounce = this.toastP >= 0.36 && this.toastP < 0.6 ? Math.sin((this.toastP - 0.36) / 0.24 * Math.PI) * 6 : 0;

    if (this.has('A')) this._drawA(t, toastW, sipA, bounce);
    if (this.has('B')) this._drawB(t, toastW, sipB, bounce);
    if (this.has('A')) this._drawBunny(t);
    if (this.has('B')) this._drawBird(t);
    this._drawHearts(t);
    ctx.restore();
  },

  /* ---------- 左：粉发骑士 ---------- */
  _drawA(t, toastW, sipW, bounce){
    const breathe = Math.sin(t * 2.1) * 2.2;
    // 椅背
    smooth([[312, 652], [366, 646], [372, 905], [314, 905]]); fs(COL.wood);
    smooth([[326, 676], [354, 672], [357, 885], [328, 885]]); fs(COL.woodDk, 0);
    ell(340, 648, 30, 9); fs(COL.woodLt);
    // 椅座 + 后腿
    smooth([[322, 896], [342, 896], [342, 962], [322, 962]]); fs(COL.woodDk);
    smooth([[318, 852], [602, 852], [604, 898], [318, 898]]); fs(COL.wood);
    line([[324, 864], [598, 864]], COL.woodLt, 4);

    ctx.save();
    ctx.translate(0, -bounce);
    // 腿：两只银色护胫
    for (const [x, y] of [[424, 880], [520, 878]]){
      smooth([[x, y], [x + 38, y], [x + 38, y + 64], [x, y + 64]]); fs(COL.armor);
      ell(x + 19, y + 6, 18, 9); fs(COL.armorLt, 2.4);
      ell(x + 20, y + 69, 25, 10); fs(COL.armorDk);
    }
    // 身体（随呼吸起伏）
    ctx.save(); ctx.translate(0, breathe * 0.6);
    smooth([[418, 702], [548, 700], [570, 762], [560, 838], [418, 840], [402, 765]]); fs(COL.armor);
    for (const y of [738, 770, 802]) line([[424, y], [488, y + 5], [554, y - 2]], COL.armorDk, 3);
    line([[420, 720], [412, 790]], COL.armorLt, 6);
    // 身前垂下来的黄绿色布片（腰到膝下）
    smooth([[432, 812], [548, 810], [560, 872], [552, 936], [440, 938], [428, 872]]); fs(COL.tunic);
    line([[470, 830], [474, 926]], COL.tunicDk, 3); line([[516, 828], [522, 926]], COL.tunicDk, 3);
    line([[434, 822], [546, 818]], COL.tunicDk, 4);   // 腰带
    ell(492, 712, 52, 15); fs(COL.tunic);            // 领口
    ctx.restore();
    // 椅子前腿（在腿旁边）
    smooth([[580, 850], [604, 850], [604, 964], [580, 964]]); fs(COL.wood);
    smooth([[402, 946], [598, 946], [598, 960], [402, 960]]); fs(COL.woodLt);   // 脚踏
    ctx.restore();

    // 头（以脖子为轴微微晃动）
    ctx.save();
    ctx.translate(470, 705 - bounce + breathe);
    ctx.rotate(Math.sin(t * 1.1) * 0.035 - sipW * 0.06);
    ctx.translate(-470, -705);
    // 后面一大团卷发
    union([
      () => fluffy(456, 528, 160, 140, 9, 0.24, -0.25),
      () => fluffy(344, 618, 76, 52, 5, 0.3, 0.6),
      () => fluffy(566, 480, 84, 66, 6, 0.24, 0.1),
      () => smooth([[300, 600], [330, 640], [312, 690], [290, 676], [286, 630]]),   // 左下垂下的一绺
    ], COL.pinkHair);
    // 发丝走向（深一点的粉）
    for (const st of [[[350, 470], [330, 520], [338, 566]], [[410, 420], [388, 470], [392, 520]], [[480, 396], [470, 440]],
                      [[300, 620], [304, 662]], [[560, 440], [584, 470]]]) line(st, COL.pinkHairDk, 3.4);
    line([[384, 446], [420, 420], [462, 410]], COL.pinkHairLt, 8);
    line([[318, 598], [346, 588]], COL.pinkHairLt, 6);
    line([[560, 430], [596, 440]], COL.pinkHairLt, 6);
    line([[360, 500], [352, 548]], COL.pinkHairDk, 4);
    line([[420, 480], [404, 530]], COL.pinkHairDk, 4);
    // 呆毛
    line([[478, 392], [486, 360], [512, 344], [530, 356]], INKC, LW + 4);   // 呆毛：一绺翘起来
    line([[478, 392], [486, 360], [512, 344], [530, 356]], COL.pinkHair, 4.5);
    // 脸
    ell(505, 622, 100, 88); fs(COL.skin);
    ell(470, 662, 18, 9); fs(COL.blush, 0); ell(596, 668, 14, 8); fs(COL.blush, 0);
    // 刘海：先填色，再只描下沿
    const bang = [[392, 486], [630, 486], [628, 552], [608, 578], [588, 554], [566, 582], [544, 556], [520, 584],
                  [497, 556], [474, 588], [454, 568], [440, 640], [416, 684], [402, 600]];
    smooth(bang); fs(COL.pinkHair, 0);
    line(bang.slice(2), INKC, LW);
    line([[560, 500], [600, 494]], COL.pinkHairLt, 7);
    // 眉毛（有点认真）
    const L = this.look.A;
    line([[508, 598], [538, 607]], INKC, 4.2); line([[562, 609], [592, 602]], INKC, 4.2);
    this._eyes([[526, 632], [582, 638]], L, this.blink.A.until > t, sipW > 0.5 || toastW > 0.6, 10, 17);
    // 嘴：张着的小嘴；喝茶时闭上
    if (sipW > 0.4) line([[545, 684], [558, 689], [571, 684]], INKC, 3.2);
    else { smooth([[541, 676], [575, 676], [571, 692], [558, 699], [545, 692]]); fs(COL.mouth, 3); ell(558, 692, 8, 4); fs(COL.mouthDk, 0); }
    ctx.restore();

    // 手臂 + 粉色杯子（最上层：喝茶时杯子在脸前）
    const shoulder = [528, 738 + breathe * 0.6 - bounce];
    let hand = lerp2([574, 754], this.mode === 'both' ? [606, 744] : [594, 690], toastW);   // 碰杯 / 一个人时举杯
    hand = lerp2(hand, [552, 702], sipW);
    hand[1] -= bounce;
    capsule(shoulder, hand, 30, COL.armor);
    line([lerp2(shoulder, hand, 0.45), [lerp2(shoulder, hand, 0.45)[0] + 2, lerp2(shoulder, hand, 0.45)[1] + 14]], COL.armorDk, 3);
    this._mug(hand[0] + 16, hand[1] - 6, -0.75 * sipW, COL.mugPink, COL.mugPinkDk, -1, sipW < 0.15 && toastW < 0.2, t);
    ell(hand[0], hand[1], 12, 11); fs(COL.armorLt);
  },

  /* ---------- 右：白发红冠 ---------- */
  _drawB(t, toastW, sipW, bounce){
    const breathe = Math.sin(t * 2.1 + 1.2) * 2.2;
    ctx.save();
    ctx.translate(0, -bounce);
    // 袍子后摆（向右飘的橙色）
    const sw = Math.sin(t * 1.6) * 6;
    smooth([[836, 790], [918, 806], [978 + sw, 850], [946 + sw, 894], [866, 898], [832, 862]]); fs(COL.robe);
    line([[872, 836], [936 + sw * 0.5, 862]], COL.robeDk, 3);
    // 裤子 + 红靴子
    smooth([[722, 868], [866, 866], [870, 918], [720, 920]]); fs(COL.pants);
    for (const x of [736, 814]){
      smooth([[x, 906], [x + 52, 906], [x + 56, 948], [x + 62, 962], [x - 2, 964], [x - 2, 930]]); fs(COL.boot);
      line([[x + 2, 918], [x + 50, 918]], COL.bootDk, 3);
    }
    // 身体（随呼吸）
    ctx.save(); ctx.translate(0, breathe * 0.6);
    smooth([[704, 694], [812, 694], [866, 884], [688, 888]]); fs(COL.robe);
    smooth([[742, 700], [780, 700], [792, 886], [734, 886]]); fs(COL.robeIn, 2.6);
    line([[716, 760], [700, 870]], COL.robeDk, 3); line([[818, 760], [846, 870]], COL.robeDk, 3);
    // 右边垂下来的大袖子
    smooth([[798, 700], [858, 748], [910, 846], [880, 878], [836, 870], [800, 812]]); fs(COL.sleeve);
    line([[842, 872], [908, 846]], COL.robeDk, 7);
    line([[828, 770], [858, 838]], COL.sleeveDk, 3);
    // 胸前的蝴蝶结
    ell(742, 720, 18, 10, 0.45); fs(COL.ribbon, 2.8); ell(780, 720, 18, 10, -0.45); fs(COL.ribbon, 2.8);
    line([[756, 728], [744, 770]], INKC, 6.5); line([[756, 728], [744, 770]], COL.ribbon, 3.5);
    line([[766, 728], [778, 772]], INKC, 6.5); line([[766, 728], [778, 772]], COL.ribbon, 3.5);
    ell(761, 722, 7, 7); fs(COL.robeDk, 2.6);
    ctx.restore();
    ctx.restore();

    // 头
    ctx.save();
    ctx.translate(755, 690 - bounce + breathe);
    ctx.rotate(Math.sin(t * 1.3 + 0.5) * 0.03 + sipW * 0.05);
    ctx.translate(-755, -690);
    // 后面一大团白发 + 左边垂下的长发
    union([
      () => fluffy(818, 480, 166, 160, 10, 0.05, 0.3),
      () => smooth([[650, 440], [704, 466], [696, 600], [684, 684], [652, 664], [638, 560]]),
      () => smooth([[836, 500], [868, 492], [872, 640], [846, 650]]),
    ], COL.whiteHair);
    line([[872, 372], [924, 420], [952, 496]], COL.whiteHairDk, 5);
    line([[800, 360], [846, 352]], COL.whiteHairDk, 3.5);
    line([[660, 480], [664, 640]], COL.whiteHairDk, 3.5);
    line([[860, 520], [858, 620]], COL.whiteHairDk, 3.5);
    // 脸
    ell(748, 572, 88, 90); fs(COL.skin);
    ell(694, 606, 16, 8); fs(COL.blush, 0); ell(810, 604, 16, 8); fs(COL.blush, 0);
    // 刘海（中分）
    const bang = [[640, 420], [852, 420], [850, 528], [816, 512], [768, 484], [748, 488], [728, 486], [690, 508], [664, 548], [648, 520]];
    smooth(bang); fs(COL.whiteHair, 0);
    line(bang.slice(2), INKC, LW);
    // 红发带（绕过头发）
    line([[690, 396], [846, 346], [958, 518]], INKC, 17);
    line([[690, 396], [846, 346], [958, 518]], COL.red, 11);
    // 红冠：斜戴在左上，后壁浅棕、前面三个尖、底下一圈红箍
    ctx.save(); ctx.translate(722, 318); ctx.rotate(-0.2);
    ctx.beginPath(); ctx.moveTo(-58, -8); ctx.lineTo(58, -14); ctx.lineTo(56, -44); ctx.lineTo(-56, -36); ctx.closePath(); fs(COL.crownSide);
    ctx.beginPath(); ctx.moveTo(-64, 6); ctx.lineTo(-66, -42); ctx.lineTo(-34, -16); ctx.lineTo(-2, -58); ctx.lineTo(26, -18);
    ctx.lineTo(62, -48); ctx.lineTo(64, 4); ctx.closePath(); fs(COL.red);
    ctx.beginPath(); ctx.moveTo(-66, 2); ctx.lineTo(66, -2); ctx.lineTo(66, 24); ctx.lineTo(-64, 30); ctx.closePath(); fs(COL.redDk);
    line([[-58, 15], [58, 11]], COL.crownSide, 4);
    ell(-2, -56, 5, 5); fs(COL.crownSide, 2); ell(-66, -42, 4, 4); fs(COL.crownSide, 2); ell(62, -48, 4, 4); fs(COL.crownSide, 2);
    ctx.restore();
    // 额头的红宝石
    smooth([[748, 486], [757, 498], [748, 510], [739, 498]]); fs(COL.red, 2.2);
    // 眉、眼、嘴（笑眯眯）
    const L = this.look.B;
    line([[700, 534], [722, 530]], INKC, 3.4); line([[782, 530], [804, 534]], INKC, 3.4);
    this._eyes([[712, 568], [792, 566]], L, this.blink.B.until > t, sipW > 0.5 || toastW > 0.6, 9.5, 15);
    line([[732, 622], [751, 634], [770, 622]], INKC, 3.2);
    ctx.restore();

    // 手臂（宽袖）+ 白杯子
    const shoulder = [716, 714 + breathe * 0.6 - bounce];
    let hand = lerp2([700, 748], this.mode === 'both' ? [676, 740] : [690, 688], toastW);
    hand = lerp2(hand, [740, 642], sipW);
    hand[1] -= bounce;
    capsule(shoulder, hand, 36, COL.sleeve);
    capsule(lerp2(shoulder, hand, 0.82), hand, 30, COL.robe);
    this._mug(hand[0] - 14, hand[1] - 6, 0.75 * sipW, COL.mugWhite, COL.mugWhiteDk, 1, sipW < 0.15 && toastW < 0.2, t);
    ell(hand[0], hand[1] + 2, 11, 10); fs(COL.skin);
  },

  /* 眼睛：平时黑色椭圆 + 高光（跟着鼠标挪一点）；眨眼时一道线；开心时 ^ ^ */
  _eyes(pos, look, blinking, happy, rx, ry){
    for (const [x0, y0] of pos){
      const x = x0 + look[0], y = y0 + look[1];
      if (happy) line([[x - rx, y + 3], [x, y - ry * 0.55], [x + rx, y + 3]], INKC, 4);
      else if (blinking) line([[x - rx, y + 2], [x, y + 5], [x + rx, y + 2]], INKC, 4);
      else {
        ell(x, y, rx, ry); fs(INKC, 0);
        ell(x - rx * 0.3, y - ry * 0.4, rx * 0.32, ry * 0.22); fs('rgba(255,255,255,0.9)', 0);
      }
    }
  },

  /* 杯子：圆角杯身 + 杯口 + 把手（side=-1 把手在左，1 在右）；不喝的时候冒热气 */
  _mug(x, y, tilt, fill, dark, side, steam, t){
    ctx.save();
    ctx.translate(x, y); ctx.rotate(tilt);
    // 把手
    ctx.beginPath(); ctx.ellipse(side * 26, 2, 11, 13, 0, -Math.PI / 2, Math.PI / 2, side < 0);
    ctx.strokeStyle = INKC; ctx.lineWidth = 11; ctx.stroke();
    ctx.strokeStyle = fill; ctx.lineWidth = 5; ctx.stroke();
    // 杯身
    smooth([[-24, -22], [24, -22], [23, 20], [16, 25], [-16, 25], [-23, 20]]); fs(fill);
    line([[-14, -10], [-15, 14]], 'rgba(255,255,255,0.7)', 5);
    line([[16, -12], [16, 14]], dark, 3);
    ell(0, -22, 24, 6); fs(dark, 2.8);
    if (steam){
      for (let i = 0; i < 2; i++){
        const ph = (t * 0.45 + i * 0.5) % 1, a = Math.sin(ph * Math.PI) * 0.45;
        const sx = -8 + i * 14, sy = -32 - ph * 38;
        ctx.beginPath();
        for (let k = 0; k <= 6; k++){
          const yy = sy - k * 4, xx = sx + Math.sin(k * 0.9 + t * 3 + i) * 4;
          k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
        }
        ctx.strokeStyle = `rgba(58,42,40,${a})`; ctx.lineWidth = 2.6; ctx.stroke();
      }
    }
    ctx.restore();
  },

  /* ---------- 粉色兔耳小鸟（左） ---------- */
  _drawBunny(t){
    const hop = this.hop.bunny >= 0 ? Math.sin(this.hop.bunny * Math.PI) * 28 : 0;
    const y = 745 + Math.sin(t * 3) * 4 - hop, x = 285;
    const ear = Math.sin(t * 2.4) * 0.08;
    ell(x - 22, y - 62, 9, 30, -0.3 + ear); fs(COL.bunnyEar); ell(x - 22, y - 60, 4, 20, -0.3 + ear); fs(COL.bunny, 0);
    ell(x - 2, y - 66, 9, 32, 0.08 - ear); fs(COL.bunnyEar); ell(x - 2, y - 64, 4, 21, 0.08 - ear); fs(COL.bunny, 0);
    fluffy(x, y, 38, 34, 9, 0.07, 0.2); fs(COL.bunny);
    ell(x + 34, y + 2, 15, 9, -0.5 + Math.sin(t * 9) * 0.35); fs(COL.bunnyDk);   // 扑腾的小翅膀
    ell(x + 12, y - 8, 3.6, 4.6); fs(INKC, 0);
    smooth([[x + 26, y - 2], [x + 37, y + 1], [x + 26, y + 5]]); fs(COL.beak, 2);
    line([[x - 8, y + 34], [x - 10, y + 44]], INKC, 3); line([[x + 8, y + 34], [x + 10, y + 44]], INKC, 3);
  },

  /* ---------- 戴小红冠的白鸟（右） ---------- */
  _drawBird(t){
    const hop = this.hop.bird >= 0 ? Math.sin(this.hop.bird * Math.PI) * 30 : 0;
    const x = 985, y = 690 + Math.sin(t * 2.4) * 6 - hop;
    smooth([[x + 30, y + 10], [x + 62, y + 18], [x + 34, y + 26]]); fs(COL.bird, 2.6);   // 尾巴
    ell(x, y, 42, 36); fs(COL.bird);
    ctx.save(); ctx.translate(x + 26, y - 4); ctx.rotate(-0.4 + Math.sin(t * 11) * 0.45);
    ell(14, 0, 20, 10); fs(COL.bird); ctx.restore();                                      // 翅膀
    line([[x - 24, y - 4], [x - 17, y - 10], [x - 10, y - 4]], INKC, 3.2);               // ^ ^ 眯眼
    line([[x + 2, y - 4], [x + 9, y - 10], [x + 16, y - 4]], INKC, 3.2);
    smooth([[x - 8, y + 4], [x + 2, y + 10], [x - 8, y + 12]]); fs(COL.beak, 2);
    // 小红冠 + 一根羽毛
    smooth([[x - 14, y - 32], [x + 16, y - 36], [x + 14, y - 52], [x + 4, y - 44], [x - 4, y - 56], [x - 12, y - 44]]); fs(COL.red, 2.6);
    line([[x + 12, y - 50], [x + 24, y - 66]], INKC, 3); line([[x + 22, y - 64], [x + 30, y - 70]], COL.red, 4);
    // 速度线
    line([[x - 50, y + 30], [x - 30, y + 36]], 'rgba(58,42,40,0.35)', 2.5);
    line([[x - 44, y + 42], [x - 26, y + 46]], 'rgba(58,42,40,0.35)', 2.5);
  },

  /* ---------- 爱心：两只小鸟身边各两颗（轻轻跳动）+ 碰杯 / 点小鸟时飘起来的 ---------- */
  _drawHearts(t){
    ctx.lineWidth = 2;
    const fixed = [...(this.has('A') ? [[206, 700, 13], [192, 748, 10]] : []), ...(this.has('B') ? [[1052, 590, 14], [1082, 642, 11]] : [])];
    fixed.forEach(([x, y, s], i) => {
      heartPath(x, y, s * (1 + Math.sin(t * 2.2 + i * 1.7) * 0.08));
      ctx.fillStyle = COL.heart; ctx.fill();
    });
    for (const p of this.hearts){
      const k = p.t / p.life, a = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.55) / 0.45);
      ctx.globalAlpha = Math.max(0, a);
      heartPath(p.x, p.y, p.size * (0.7 + 0.3 * Math.min(1, k * 4)));
      ctx.fillStyle = COL.heart; ctx.fill();
      ctx.strokeStyle = INKC; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },
};
