"use strict";
/* ============================================================
   room.js：2D 小房间（俯视）—— 粉发骑士在里面走来走去，兔耳小鸟跟在身后
   ------------------------------------------------------------
   WASD 移动；E 互动（接口留好了，目前没有任何互动）
   动画状态：IDLE（站着：呼吸、眨眼、站久了喝一口）/ MOVE（走路）
   家具会挡路；按脚底的 y 排前后（走到家具后面会被挡住）
   点骑士：举杯冒爱心；点小鸟：跳一下。完成任务 / 打卡 / 番茄结束（celebrate）也会举杯
   坐标：房间自己的「世界坐标」，576 × 480（上面 150 是墙，下面是地板）
   ============================================================ */

const ROOM_W = 576, ROOM_H = 480, WALL_H = 150;
const KS = 0.2;            // 骑士：局部坐标 → 世界坐标的缩放（人约 105 高）
const BS = 0.36;           // 兔耳小鸟的缩放
const SPEED = 150;         // 走路速度（世界单位 / 秒）
const FOOT = { hw: 16, hh: 7 };   // 脚底碰撞盒的半宽 / 半高
const BOUNDS = { x0: 26, x1: ROOM_W - 26, y0: WALL_H + 22, y1: ROOM_H - 18 };

/* 家具：box 是挡路的脚底范围（世界坐标），sortY 决定前后，draw 在世界坐标里画 */
const FURNITURE = [
  { name: '书架', box: [28, 160, 132, 198], sortY: 198, draw: drawShelf },
  { name: '书桌', box: [398, 178, 542, 214], sortY: 214, draw: drawDesk },
  { name: '茶几', box: [256, 324, 346, 356], sortY: 356, draw: drawTeaTable },
  { name: '木椅', box: [166, 322, 214, 350], sortY: 350, draw: drawChair },
  { name: '盆栽', box: [508, 424, 554, 452], sortY: 452, draw: drawPlant },
];

const Room = {
  t: 0,
  x: 300, y: 420,            // 骑士脚底（世界坐标）
  facing: 1,
  moving: false, phase: 0,
  idleFor: 0,
  keys: new Set(),
  blink: { at: 1.6, until: 0 },
  sip: -1, nextSip: 5,
  cheer: -1, cheered: false,
  look: [0, 0], pointer: null,
  bunny: { x: 250, y: 430, facing: 1, hop: 0, jump: -1 },
  hearts: [], puffs: [], puffAcc: 0,
  s: 1, ox: 0, oy: 0,

  /* ---------- 布局：房间居中在舞台可用区域，最大 1 倍（「做小一点」） ---------- */
  layout(){
    const aw = Math.max(240, W - insetR);
    this.s = Math.max(0.3, Math.min(1, aw * 0.86 / ROOM_W, (H - 200) / ROOM_H));
    this.ox = CX - ROOM_W / 2 * this.s;
    this.oy = Math.max(84, (H - 110 - ROOM_H * this.s) / 2 + 30);
  },
  toWorld(px, py){ return [(px - this.ox) / this.s, (py - this.oy) / this.s]; },

  /* ---------- 输入 ---------- */
  keyDown(code){
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(code)){ this.keys.add(code); return true; }
    if (code === 'KeyE'){ this.interact(); return true; }
    return false;
  },
  keyUp(code){ this.keys.delete(code); },
  clearKeys(){ this.keys.clear(); },
  /* E：互动 —— 先留空，以后在这里判断「面前是什么家具」再决定做什么 */
  interact(){},

  hit(px, py){
    const [x, y] = this.toWorld(px, py);
    const b = this.bunny;
    if (Math.hypot(x - b.x, y - (b.y - 14)) < 20) return 'bunny';
    if (Math.abs(x - this.x) < 34 && y < this.y + 4 && y > this.y - 112) return 'knight';
    return null;
  },
  click(px, py){
    const who = this.hit(px, py);
    if (who === 'knight') this.doCheer();
    else if (who === 'bunny'){ this.bunny.jump = 0; this._burst(this.bunny.x, this.bunny.y - 30, 2); chirp(); }
    return !!who;
  },
  doCheer(){
    if (this.cheer >= 0 && this.cheer < 0.5) return;
    this.sip = -1; this.cheer = 0; this.cheered = false;
  },
  _burst(x, y, n){
    for (let i = 0; i < n; i++) this.hearts.push({ x: x + rnd(-6, 6), y: y + rnd(-4, 4), vx: rnd(-14, 14), vy: rnd(-48, -30),
      t: 0, life: rnd(1.2, 1.8), size: rnd(5, 8), ph: rnd(0, TAU) });
  },

  /* ---------- 碰撞：脚底的小盒子不能进墙、不能进家具 ---------- */
  _blocked(x, y){
    if (x - FOOT.hw < BOUNDS.x0 || x + FOOT.hw > BOUNDS.x1 || y - FOOT.hh < BOUNDS.y0 || y + FOOT.hh > BOUNDS.y1) return true;
    for (const f of FURNITURE){
      const [x0, y0, x1, y1] = f.box;
      if (x + FOOT.hw > x0 && x - FOOT.hw < x1 && y + FOOT.hh > y0 && y - FOOT.hh < y1) return true;
    }
    return false;
  },

  /* ---------- 每帧 ---------- */
  update(dt){
    const t = (this.t += dt);
    // 移动（WASD，斜着走不会更快）；先走 x 再走 y，撞上就贴着走
    let dx = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    let dy = (this.keys.has('KeyS') ? 1 : 0) - (this.keys.has('KeyW') ? 1 : 0);
    const len = Math.hypot(dx, dy);
    this.moving = len > 0;
    if (this.moving){
      dx /= len; dy /= len;
      const nx = this.x + dx * SPEED * dt, ny = this.y + dy * SPEED * dt;
      if (!this._blocked(nx, this.y)) this.x = nx;
      if (!this._blocked(this.x, ny)) this.y = ny;
      if (dx) this.facing = dx > 0 ? 1 : -1;
      this.phase += dt * 11;
      this.idleFor = 0; this.sip = -1;
      // 脚下扬起的小灰尘
      if ((this.puffAcc += dt) > 0.24){ this.puffAcc = 0; this.puffs.push({ x: this.x - this.facing * 10, y: this.y - 2, t: 0 }); }
    } else {
      this.phase = 0; this.idleFor += dt;
    }
    // 眨眼
    if (t >= this.blink.at){ this.blink.until = t + 0.13; this.blink.at = t + (Math.random() < 0.2 ? 0.28 : rnd(2.5, 5.5)); }
    // IDLE 久了喝一口
    if (this.sip >= 0){ this.sip += dt / 2.2; if (this.sip > 1) this.sip = -1; }
    else if (!this.moving && this.cheer < 0 && this.idleFor > 3 && t > this.nextSip){ this.sip = 0; this.nextSip = t + rnd(7, 12); }
    // 举杯：到 0.3 时「叮」+ 冒爱心
    if (this.cheer >= 0){
      this.cheer += dt / 1.3;
      if (!this.cheered && this.cheer >= 0.3){
        this.cheered = true; clink();
        this._burst(this.x + this.facing * 22, this.y - 66, 5);
      }
      if (this.cheer > 1) this.cheer = -1;
    }
    // 兔耳小鸟跟在身后（落后一点、一蹦一蹦）
    const b = this.bunny, tx = this.x - this.facing * 40, ty = this.y + 6;
    const bx = tx - b.x, by = ty - b.y, bd = Math.hypot(bx, by);
    if (bd > 4){
      const v = Math.min(bd * 4, SPEED * 1.15) * dt;
      b.x += bx / bd * v; b.y += by / bd * v;
      if (Math.abs(bx) > 3) b.facing = bx > 0 ? 1 : -1;
      b.hop += dt * 12;
    } else { b.hop = 0; b.facing = this.facing; }
    if (b.jump >= 0){ b.jump += dt / 0.5; if (b.jump > 1) b.jump = -1; }
    // 粒子
    for (let i = this.hearts.length - 1; i >= 0; i--){
      const p = this.hearts[i];
      p.t += dt; p.x += (p.vx + Math.sin(p.t * 4 + p.ph) * 10) * dt; p.y += p.vy * dt;
      if (p.t > p.life) this.hearts.splice(i, 1);
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) if ((this.puffs[i].t += dt) > 0.5) this.puffs.splice(i, 1);
    // 眼睛跟着鼠标
    let lx = 0, ly = 0;
    if (this.pointer){
      const [wx, wy] = this.toWorld(this.pointer[0], this.pointer[1]);
      const ex = this.x + this.facing * 17, ey = this.y - 48;
      const ddx = (wx - ex) * this.facing, ddy = wy - ey, d = Math.hypot(ddx, ddy) || 1, m = Math.min(5, d / 12);
      lx = ddx / d * m; ly = ddy / d * m;
    }
    const k = Math.min(1, dt * 6);
    this.look[0] += (lx - this.look[0]) * k; this.look[1] += (ly - this.look[1]) * k;
  },

  draw(){
    this.layout();
    const t = this.t;
    ctx.save();
    ctx.translate(this.ox, this.oy);
    ctx.scale(this.s, this.s);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    drawRoomShell(t);
    // 地上的灰尘
    for (const p of this.puffs){
      const k = p.t / 0.5;
      ell(p.x, p.y, 4 + k * 8, 2 + k * 3); fs(`rgba(150,130,110,${0.35 * (1 - k)})`, 0);
    }
    // 按脚底 y 排前后：家具、骑士、小鸟
    const b = this.bunny;
    const items = FURNITURE.map(f => ({ y: f.sortY, draw: () => f.draw(t) }));
    items.push({ y: this.y, draw: () => this._drawKnight() });
    items.push({ y: b.y, draw: () => {
      const hopY = Math.abs(Math.sin(b.hop)) * 7 + (b.jump >= 0 ? Math.sin(b.jump * Math.PI) * 16 : 0);
      ell(b.x, b.y, 11, 3.5); fs('rgba(90,70,60,0.18)', 0);   // 影子
      ctx.save(); ctx.translate(b.x, b.y - 16 - hopY + Math.sin(t * 3) * 1.2); ctx.scale(b.facing * BS, BS);
      LINE_K = 2.2; drawBunny(t, b.hop ? 14 : 9); LINE_K = 1;
      ctx.restore();
    } });
    items.sort((a, c) => a.y - c.y);
    for (const it of items) it.draw();
    drawHeartParticles(this.hearts);
    ctx.restore();
  },
  _drawKnight(){
    ell(this.x, this.y, 22, 6); fs('rgba(90,70,60,0.18)', 0);   // 脚下的影子
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.facing * KS, KS);
    LINE_K = 2.4;
    drawKnight({
      t: this.t, moving: this.moving, phase: this.phase,
      blinking: this.blink.until > this.t,
      sipW: envelope(this.sip, 0.28, 0.42), cheerW: envelope(this.cheer, 0.28, 0.3),
      look: this.look,
    });
    LINE_K = 1;
    ctx.restore();
  },
};

/* ============================================================
   房间和家具（世界坐标，钢笔淡彩）
   ============================================================ */
const WLW = 2.2;   // 家具的勾边粗细
const rgbS = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

function drawRoomShell(t){
  const tint = curWash();
  // 墙：纸色里透一点主题色，下面一圈护墙板
  ctx.beginPath(); ctx.rect(0, 0, ROOM_W, WALL_H); fs(rgbS(lerpC(PAPER, tint, 0.35)), 0);
  ctx.beginPath(); ctx.rect(0, WALL_H - 34, ROOM_W, 34); fs(rgbS(lerpC([214, 196, 170], tint, 0.15)), 0);
  line([[0, WALL_H - 34], [ROOM_W, WALL_H - 34]], INKC, 1.6);
  // 窗：天空 + 慢慢飘的云
  ctx.save();
  ctx.beginPath(); ctx.rect(226, 22, 124, 82); ctx.clip();
  ctx.fillStyle = '#cfe2ea'; ctx.fillRect(226, 22, 124, 82);
  for (const [cx, cy, r, sp] of [[0, 52, 14, 6], [60, 74, 10, 4]]){
    const x = 226 + ((cx + t * sp) % 160) - 20;
    fluffy(x, cy, r * 1.6, r * 0.8, 5, 0.25); fs('rgba(255,255,255,0.9)', 0);
  }
  ctx.restore();
  ctx.beginPath(); ctx.rect(226, 22, 124, 82); fs(null, WLW + 1);
  line([[288, 22], [288, 104]], INKC, WLW); line([[226, 63], [350, 63]], INKC, WLW);
  ctx.beginPath(); ctx.rect(218, 102, 140, 8); fs(COL.woodLt, WLW);   // 窗台
  // 墙上的小画
  ctx.beginPath(); ctx.rect(160, 44, 40, 48); fs('#f7f1e3', WLW);
  ell(180, 70, 10, 9); fs(COL.bunny, 1.4); ell(176, 58, 3, 8, -0.3); fs(COL.bunnyEar, 1.2); ell(184, 58, 3, 8, 0.2); fs(COL.bunnyEar, 1.2);
  // 地板：木板
  ctx.beginPath(); ctx.rect(0, WALL_H, ROOM_W, ROOM_H - WALL_H); fs('#dcbf98', 0);
  for (let y = WALL_H + 30, i = 0; y < ROOM_H; y += 30, i++){
    line([[0, y], [ROOM_W, y]], 'rgba(120,85,55,0.35)', 1.2);
    for (let x = (i % 2) * 70 + 40; x < ROOM_W; x += 140) line([[x, y - 30], [x, y]], 'rgba(120,85,55,0.25)', 1.1);
  }
  line([[0, WALL_H], [ROOM_W, WALL_H]], INKC, WLW);
  // 地毯（主题色）
  ell(300, 352, 158, 62); fs(rgbS(tint), WLW);
  ctx.setLineDash([5, 6]); ell(300, 352, 140, 52); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
  // 房间外框
  ctx.beginPath(); ctx.rect(0, 0, ROOM_W, ROOM_H); fs(null, WLW + 1.4);
}

function drawShelf(){
  ctx.beginPath(); ctx.rect(30, 40, 100, 158); fs(COL.wood, WLW);
  ctx.beginPath(); ctx.rect(38, 48, 84, 142); fs(COL.woodDk, 0);
  const books = ['#c96f6a', '#7e9fb0', '#d8b25c', '#8daa86', '#b48ab0', '#e6d6b8'];
  for (const [y, n] of [[48, 6], [96, 5], [144, 4]]){
    ctx.beginPath(); ctx.rect(36, y + 44, 88, 5); fs(COL.woodLt, 1.4);
    for (let i = 0, x = 42; i < n; i++){
      const w = 9 + (i * 5) % 6, h = 32 + (i * 7) % 10;
      ctx.beginPath(); ctx.rect(x, y + 44 - h, w, h); fs(books[(i + y) % books.length], 1.4);
      x += w + 2;
    }
  }
}
function drawDesk(t){
  ctx.beginPath(); ctx.rect(400, 168, 140, 20); fs(COL.woodLt, WLW);   // 桌面
  ctx.beginPath(); ctx.rect(404, 188, 132, 12); fs(COL.wood, WLW);
  for (const x of [406, 524]){ ctx.beginPath(); ctx.rect(x, 200, 10, 14); fs(COL.woodDk, WLW); }
  // 台灯、纸、小杯子
  ctx.beginPath(); ctx.rect(418, 158, 34, 12); fs('#f7f1e3', 1.4);
  line([[502, 168], [502, 132]], INKC, 2.4);
  smooth([[488, 136], [516, 136], [508, 120], [496, 120]]); fs('#efd9a0', 1.8);
  ell(502, 140, 22, 6); fs(`rgba(255,236,170,${0.25 + Math.sin(t * 2) * 0.05})`, 0);
  ctx.beginPath(); ctx.rect(462, 152, 14, 16); fs(COL.mugPink, 1.4);
}
function drawTeaTable(t){
  for (const x of [266, 334]){ ctx.beginPath(); ctx.rect(x - 4, 330, 8, 24); fs(COL.woodDk, WLW); }
  ell(300, 330, 54, 20); fs(COL.wood, WLW);
  ell(300, 326, 54, 20); fs(COL.woodLt, WLW);
  // 茶壶 + 两只杯子
  ell(296, 316, 16, 12); fs('#f7f3ea', 1.8); ell(296, 305, 5, 2.5); fs('#d9cdb8', 1.4);
  line([[311, 314], [322, 307]], INKC, 4); line([[311, 314], [322, 307]], '#f7f3ea', 2);
  ell(268, 326, 6, 5); fs(COL.mugPink, 1.4); ell(328, 330, 6, 5); fs('#fdfdfb', 1.4);
  const ph = (t * 0.5) % 1;
  line([[296, 298 - ph * 14], [299, 292 - ph * 14], [296, 286 - ph * 14]], `rgba(58,42,40,${Math.sin(ph * Math.PI) * 0.4})`, 1.6);
}
function drawChair(){
  // 原画里那把木椅：靠背 + 椅座 + 腿
  ctx.beginPath(); ctx.rect(170, 282, 12, 66); fs(COL.woodDk, WLW);
  ctx.beginPath(); ctx.rect(168, 278, 16, 6); fs(COL.woodLt, WLW);
  ctx.beginPath(); ctx.rect(172, 318, 44, 10); fs(COL.wood, WLW);
  for (const x of [176, 208]){ ctx.beginPath(); ctx.rect(x - 3, 328, 6, 22); fs(COL.woodDk, WLW); }
}
function drawPlant(t){
  const sway = Math.sin(t * 1.3) * 0.05;
  ctx.save(); ctx.translate(531, 424); ctx.rotate(sway);
  for (const [a, l] of [[-0.9, 34], [-0.4, 42], [0.1, 38], [0.6, 34], [-0.15, 28]]){
    ctx.save(); ctx.rotate(a); ell(0, -l / 2, 8, l / 2); fs('#8fb08a', 1.6); line([[0, -2], [0, -l + 4]], '#6f8f6a', 1.2); ctx.restore();
  }
  ctx.restore();
  smooth([[512, 422], [550, 422], [546, 452], [516, 452]]); fs('#c98a62', WLW);
  ctx.beginPath(); ctx.rect(510, 418, 42, 7); fs('#b6774f', WLW);
}
