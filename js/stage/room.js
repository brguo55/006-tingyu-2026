"use strict";
/* ============================================================
   room.js：横版 2D 地图（空洞骑士那种纯侧面）—— 一栋两层的小房子，镜头锁定骑士
   ------------------------------------------------------------
   A / D 左右走；空格跳（按得越久跳得越高），空中再按一次 = 二段跳；站在家具上按 S 跳下来；
   E 互动（接口留好了，目前没有任何互动）；W 先空着（以后进门 / 上楼梯）
   一开始骑士坐在他那把木椅上（原画的姿势），一动就站起来
   动画状态：SIT / IDLE / MOVE / JUMP / FALL，起跳拉长、落地压扁、扬起灰尘
   家具的顶面都是「单向平台」：从下面能穿上去，从上面落下能站住（阁楼的木地板也是）
   镜头：平滑跟随骑士、朝他走的方向多看一点、到地图边缘停住
   视差：窗外的景色移动得慢（远），前景的柱子 / 植物移动得快（近）→ 2.5D 的深度
   ------------------------------------------------------------
   地图（世界坐标）3600 × 1000，约 4 屏宽、2 屏高；地板 y = 940，阁楼地板 y = 560
   一楼从左到右：门厅 → 书房（两个高书架，挑高到屋顶）→ 茶室（窗、木椅、茶几）→ 工作间（书桌、电脑）→ 大窗
   二楼阁楼（x 2100–3560）：床、圆窗、纸箱；从茶室旁边的一排置物板跳上去
   ============================================================ */

const MAP_W = 3600, MAP_H = 1000, FLOOR_Y = 940, MEZZ_Y = 560, MEZZ_X0 = 2100;
const WALL_L = 40, WALL_R = 3560, CEIL_Y = 20;
const VIEW_W = 896, VIEW_H = 504;      // 镜头看到的范围（世界单位，16:9）
const KS = 0.18;                       // 骑士：局部坐标 → 世界坐标的缩放（人约 95 高）
const KH = 95, KHW = 15;               // 骑士的高 / 半宽（碰撞用）
const BS = 0.3;                        // 兔耳小鸟的缩放
/* 手感：参照空洞骑士 —— 起步快、空中可以转向、下落比上升快、松开空格就不再往上 */
const RUN = 170, GRAV = 1500, FALL_MUL = 1.35, JUMP_V = 562, CUT_V = 210, MAX_FALL = 720;
const AIR_JUMP_V = 520, AIR_JUMPS = 1;  // 二段跳：比第一跳略低；落地后恢复次数
const APEX_V = 90, APEX_GRAV = 0.55;   // 按住空格时，快到最高点那一下重力变小 → 有一点悬空感、好控制
const AIR_CONTROL = 15;                // 空中转向的灵敏度（地面是 22）
const COYOTE = 0.09, BUFFER = 0.12;    // 走出边缘后还能起跳的时间 / 提前按跳的缓冲
const FG_PAR = 0.3, FAR_PAR = 0.5;     // 前景比中景多移动 30%；窗外景色只移动一半

/* ---------- 能站的面（单向平台）[x0, x1, y] ---------- */
const PLATS = [];
const plat = (name, x0, x1, y) => { const p = { name, x0, x1, y }; PLATS.push(p); return p; };
plat('阁楼', MEZZ_X0, WALL_R, MEZZ_Y);
plat('鞋凳', 330, 430, 912);
plat('书架', 636, 764, 700);
plat('书架', 976, 1104, 650);
plat('小凳', 860, 910, 900);
for (const [x0, x1, y] of [[790, 860, 820], [870, 950, 740], [1120, 1200, 570], [1220, 1300, 480], [1300, 1380, 400]]) plat('置物板', x0, x1, y);
plat('窗台', 1508, 1732, 840);
const CHAIR_SEAT = plat('木椅', 1814, 1880, 928);
plat('茶几', 1920, 2020, 910);
for (const [x0, x1, y] of [[2120, 2200, 860], [2230, 2310, 780], [2120, 2200, 700], [2230, 2310, 620]]) plat('置物板', x0, x1, y);
plat('转椅', 2400, 2452, 905);
plat('书桌', 2476, 2704, 870);
plat('矮书柜', 2756, 2864, 860);
plat('窗台', 3040, 3260, 860);
plat('纸箱', 2400, 2460, 520);
plat('纸箱', 2460, 2512, 480);
plat('床', 3150, 3360, 520);

const Room = {
  t: 0,
  x: 1840, y: FLOOR_Y, vx: 0, vy: 0,
  facing: 1,
  sitting: true,                    // 一开始坐在木椅上
  grounded: true, ground: null,     // 站在哪：null = 地板，否则是平台
  coyote: 0, jumpBuf: 0, jumpHeld: false, airJumps: AIR_JUMPS,
  groundY: FLOOR_Y,                 // 最近一次站稳的高度（镜头按它定高，小跳时不上下晃）
  drop: null, dropUntil: 0,
  sq: [1, 1],                       // 挤压 / 拉伸
  phase: 0, idleFor: 0,
  keys: new Set(),
  blink: { at: 1.6, until: 0 },
  sip: -1, nextSip: 3,
  cheer: -1, cheered: false,
  look: [0, 0], pointer: null,
  cam: { x: 0, y: 0 }, lookAhead: 0, camReady: false,
  bunny: { x: 1800, y: 860, facing: 1, jump: -1 },
  hearts: [], puffs: [], feathers: [], puffAcc: 0,
  s: 1, ox: 0, oy: 0,

  /* ---------- 布局：镜头画面居中在舞台可用区域，最大 1 倍 ---------- */
  layout(){
    const aw = Math.max(240, W - insetR);
    this.s = Math.max(0.3, Math.min(1, aw * 0.9 / VIEW_W, (H - 200) / VIEW_H));
    this.ox = CX - VIEW_W / 2 * this.s;
    this.oy = Math.max(80, (H - 110 - VIEW_H * this.s) / 2 + 20);
  },
  toWorld(px, py){ return [(px - this.ox) / this.s + this.cam.x, (py - this.oy) / this.s + this.cam.y]; },

  /* ---------- 输入 ---------- */
  keyDown(code){
    if (code === 'KeyA' || code === 'KeyD'){ this.keys.add(code); return true; }
    if (code === 'Space'){ if (!this.jumpHeld){ this.jumpBuf = BUFFER; } this.jumpHeld = true; return true; }
    if (code === 'KeyS'){ this.dropDown(); return true; }
    if (code === 'KeyE'){ this.interact(); return true; }
    if (code === 'KeyW') return true;   // 先空着：以后进门 / 上楼梯
    return false;
  },
  keyUp(code){ this.keys.delete(code); if (code === 'Space') this.jumpHeld = false; },
  clearKeys(){ this.keys.clear(); this.jumpHeld = false; },
  /* E：互动 —— 先留空，以后在这里判断「面前是什么家具」再决定做什么（比如坐回椅子、用电脑） */
  interact(){},
  /* S：从平台上跳下来（地板上按没反应） */
  dropDown(){
    if (this.sitting || !this.grounded || !this.ground) return;
    this.drop = this.ground; this.dropUntil = this.t + 0.3;
    this.grounded = false; this.ground = null; this.y += 2; this.vy = 80;
  },
  /* 从椅子上站起来：轻轻一跳落到地上 */
  standUp(dir){
    this.sitting = false; this.sip = -1;
    this.grounded = false; this.ground = null; this.airJumps = AIR_JUMPS;
    this.vy = -230; this.vx = (dir || 1) * 70;
    this.drop = CHAIR_SEAT; this.dropUntil = this.t + 0.4;
    this.sq = [0.92, 1.08];
  },

  hit(px, py){
    const [x, y] = this.toWorld(px, py);
    const b = this.bunny;
    if (Math.hypot(x - b.x, y - b.y) < 18) return 'bunny';
    if (Math.abs(x - this.x) < 30 && y < this.y + 4 && y > this.y - KH) return 'knight';
    return null;
  },
  click(px, py){
    const who = this.hit(px, py);
    if (who === 'knight') this.doCheer();
    else if (who === 'bunny'){ this.bunny.jump = 0; this._burst(this.bunny.x, this.bunny.y - 14, 2); chirp(); }
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
  _featherBurst(){
    for (let i = 0; i < 8; i++){
      const a = Math.PI * (0.15 + 0.7 * i / 7);   // 往下半圈散开
      this.feathers.push({ x: this.x, y: this.y - 6, vx: Math.cos(a) * rnd(60, 130) * (i % 2 ? 1 : -1), vy: Math.sin(a) * rnd(20, 70),
        rot: rnd(0, TAU), vr: rnd(-6, 6), t: 0, life: rnd(0.45, 0.7), ph: rnd(0, TAU), pink: i % 3 === 0 });
    }
    this.puffs.push({ x: this.x, y: this.y, vx: 0, t: 0, big: true, ring: true });
  },
  _dust(x, y, n, spread){
    for (let i = 0; i < n; i++) this.puffs.push({ x: x + rnd(-spread, spread), y, vx: rnd(-1, 1) * spread * 2, t: 0, big: n > 1 });
  },

  /* ---------- 每帧 ---------- */
  update(dt){
    const t = (this.t += dt);
    const dir = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    if (this.sitting){
      // 坐着：一按方向键或空格就站起来
      if (dir || this.jumpBuf > 0){ this.jumpBuf = 0; if (dir) this.facing = dir; this.standUp(dir); }
      else this.idleFor += dt;
    }
    if (!this.sitting) this._physics(dt, dir);
    this.sq[0] += (1 - this.sq[0]) * Math.min(1, dt * 14);
    this.sq[1] += (1 - this.sq[1]) * Math.min(1, dt * 14);
    // 走路节奏 / 小灰尘 / 站着不动多久了
    const walking = !this.sitting && this.grounded && Math.abs(this.vx) > 20;
    if (walking){
      this.phase += dt * 11 * Math.abs(this.vx) / RUN;
      if ((this.puffAcc += dt) > 0.22){ this.puffAcc = 0; this._dust(this.x - this.facing * 9, this.y, 1, 2); }
      this.idleFor = 0; this.sip = -1;
    } else if (!this.sitting){ this.phase = 0; if (this.grounded) this.idleFor += dt; else this.idleFor = 0; }
    // 眨眼
    if (t >= this.blink.at){ this.blink.until = t + 0.13; this.blink.at = t + (Math.random() < 0.2 ? 0.28 : rnd(2.5, 5.5)); }
    // 不动久了喝一口（坐着也会）
    if (this.sip >= 0){ this.sip += dt / 2.2; if (this.sip > 1) this.sip = -1; }
    else if ((this.sitting || (this.grounded && !walking)) && this.cheer < 0 && this.idleFor > 3 && t > this.nextSip){ this.sip = 0; this.nextSip = t + rnd(7, 12); }
    // 举杯：到 0.3 时「叮」+ 冒爱心
    if (this.cheer >= 0){
      this.cheer += dt / 1.3;
      if (!this.cheered && this.cheer >= 0.3){
        this.cheered = true; clink();
        this._burst(this.x + this.facing * 20, this.y - 60, 5);
      }
      if (this.cheer > 1) this.cheer = -1;
    }
    // 兔耳小鸟：在骑士身后上方飞着跟随；骑士坐着时停在椅背旁边
    const b = this.bunny;
    const [tx, ty] = this.sitting ? [CHAIR_SEAT.x0 - 6, CHAIR_SEAT.y - 74] : [this.x - this.facing * 48, this.y - 96];
    const k = Math.min(1, dt * 3.5);
    b.x += (tx - b.x) * k; b.y += (ty - b.y) * k;
    if (Math.abs(tx - b.x) > 3) b.facing = tx > b.x ? 1 : -1; else b.facing = this.facing;
    if (b.jump >= 0){ b.jump += dt / 0.5; if (b.jump > 1) b.jump = -1; }
    // 粒子
    for (let i = this.hearts.length - 1; i >= 0; i--){
      const p = this.hearts[i];
      p.t += dt; p.x += (p.vx + Math.sin(p.t * 4 + p.ph) * 10) * dt; p.y += p.vy * dt;
      if (p.t > p.life) this.hearts.splice(i, 1);
    }
    for (let i = this.puffs.length - 1; i >= 0; i--){
      const p = this.puffs[i]; p.t += dt; p.x += p.vx * dt;
      if (p.t > 0.5) this.puffs.splice(i, 1);
    }
    for (let i = this.feathers.length - 1; i >= 0; i--){
      const f = this.feathers[i]; f.t += dt;
      f.vy += 260 * dt; f.vx *= Math.exp(-dt * 3);
      f.x += (f.vx + Math.sin(f.t * 9 + f.ph) * 14) * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
      if (f.t > f.life) this.feathers.splice(i, 1);
    }
    this._camera(dt, walking);
    // 眼睛跟着鼠标
    let lx = 0, ly = 0;
    if (this.pointer){
      const [wx, wy] = this.toWorld(this.pointer[0], this.pointer[1]);
      const ex = this.x + this.facing * 15, ey = this.y - 43;
      const ddx = (wx - ex) * this.facing, ddy = wy - ey, d = Math.hypot(ddx, ddy) || 1, m = Math.min(5, d / 12);
      lx = ddx / d * m; ly = ddy / d * m;
    }
    const kl = Math.min(1, dt * 6);
    this.look[0] += (lx - this.look[0]) * kl; this.look[1] += (ly - this.look[1]) * kl;
  },

  _physics(dt, dir){
    const t = this.t;
    // 左右：地上起步 / 刹车很快，空中稍慢但能转向
    this.vx += (dir * RUN - this.vx) * Math.min(1, dt * (this.grounded ? 22 : AIR_CONTROL));
    if (dir) this.facing = dir;
    this.x = clamp(this.x + this.vx * dt, WALL_L + KHW, WALL_R - KHW);
    // 走出平台边缘 → 开始下落（留一点「土狼时间」还能起跳）
    if (this.grounded && this.ground){
      const p = this.ground;
      if (this.x < p.x0 - 6 || this.x > p.x1 + 6){ this.grounded = false; this.ground = null; this.coyote = COYOTE; }
    }
    // 跳：提前一点按也算（缓冲），刚走出边缘也能跳（土狼时间）
    if (!this.grounded) this.coyote = Math.max(0, this.coyote - dt);
    if (this.jumpBuf > 0 && (this.grounded || this.coyote > 0)){
      this.vy = -JUMP_V; this.grounded = false; this.ground = null; this.coyote = 0; this.jumpBuf = 0;
      this.sq = [0.88, 1.14];
      this._dust(this.x, this.y, 1, 4);
      this.sip = -1;
    } else if (this.jumpBuf > 0 && !this.grounded && this.airJumps > 0){
      // 二段跳：空中再蹬一下，脚下散开一圈小羽毛
      this.airJumps--; this.jumpBuf = 0;
      this.vy = -AIR_JUMP_V;
      this.sq = [0.84, 1.18];
      this._featherBurst();
      flap();
    }
    if (!this.jumpHeld && this.vy < -CUT_V) this.vy = -CUT_V;   // 松开空格：不再往上
    if (this.grounded) return;
    // 重力（下落更快；按住空格时最高点附近变轻）+ 落地
    let g = GRAV * (this.vy > 0 ? FALL_MUL : 1);
    if (this.jumpHeld && Math.abs(this.vy) < APEX_V) g *= APEX_GRAV;
    this.vy = Math.min(MAX_FALL, this.vy + g * dt);
    const prevY = this.y;
    this.y += this.vy * dt;
    if (this.y - KH < CEIL_Y + 4){ this.y = CEIL_Y + 4 + KH; this.vy = Math.max(0, this.vy); }   // 撞到屋顶
    if (this.vy < 0) return;
    let land = null, landY = Infinity;
    if (this.y >= FLOOR_Y){ land = 'floor'; landY = FLOOR_Y; }
    for (const p of PLATS){
      if (p === this.drop && t < this.dropUntil) continue;
      if (prevY <= p.y + 0.5 && this.y >= p.y && this.x >= p.x0 - 6 && this.x <= p.x1 + 6 && p.y < landY){ land = p; landY = p.y; }
    }
    if (!land) return;
    const impact = this.vy;
    this.y = landY; this.vy = 0; this.grounded = true; this.ground = land === 'floor' ? null : land;
    this.airJumps = AIR_JUMPS; this.groundY = landY;
    if (impact > 260){
      const k = Math.min(1, impact / MAX_FALL);
      this.sq = [1 + 0.2 * k, 1 - 0.2 * k];
      this._dust(this.x, this.y, 3, 10 * k + 4);
    }
  },

  /* 镜头：平滑跟随，朝前多看一点；人站在画面偏下的位置；到地图边缘停住 */
  _camera(dt, walking){
    this.lookAhead += (this.facing * (walking ? 90 : 40) - this.lookAhead) * Math.min(1, dt * 1.8);
    const tx = clamp(this.x + this.lookAhead - VIEW_W / 2, 0, MAP_W - VIEW_W);
    // 竖直：按「最近站稳的高度」定镜头 → 原地小跳 / 二段跳时镜头不上下晃；
    // 人快跑出画面上沿 / 下沿（比如从高处往下掉）时才直接跟着人走
    let refY = this.sitting ? this.y : this.groundY;
    const sy = this.y - this.cam.y;
    if (!this.grounded && (sy < VIEW_H * 0.3 || sy > VIEW_H * 0.86)) refY = this.y;
    if (!this.grounded && this.y > this.groundY + 40) refY = this.y;   // 掉到比原来低的地方
    const ty = clamp(refY - VIEW_H * 0.68, 0, MAP_H - VIEW_H);
    if (!this.camReady){ this.cam.x = tx; this.cam.y = ty; this.camReady = true; return; }
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 5);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * (this.vy > 300 ? 7 : 3.5));
  },

  draw(){
    this.layout();
    const t = this.t, cam = this.cam;
    ctx.save();
    ctx.translate(this.ox, this.oy);
    ctx.scale(this.s, this.s);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, VIEW_W, VIEW_H); ctx.clip();
    // ---- 中景（世界坐标）：房子、家具、骑士 ----
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    drawHouse(t, cam);
    if (!this.sitting) drawArmchair(true, true);
    for (const p of this.puffs){
      const k = p.t / 0.5, r = p.big ? 6 : 4;
      if (p.ring){ ell(p.x, p.y, 10 + k * 40, 4 + k * 10); ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - k)})`; ctx.lineWidth = 3.2; ctx.stroke(); continue; }
      ell(p.x, p.y - 2 - k * 4, r + k * 7, (r + k * 7) * 0.55); fs(`rgba(150,130,110,${0.4 * (1 - k)})`, 0);
    }
    for (const f of this.feathers){
      const a = 1 - Math.max(0, (f.t / f.life - 0.5) * 2);
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.globalAlpha = a;
      ell(0, 0, 8.5, 3.6); fs(f.pink ? COL.pinkHairLt : '#fffdf8', 1.4);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (this.sitting) drawArmchair(true, false);              // 椅背在骑士身后
    const b = this.bunny;
    const hop = b.jump >= 0 ? Math.sin(b.jump * Math.PI) * 14 : 0;
    ctx.save(); ctx.translate(b.x, b.y - hop + Math.sin(t * 3) * 4); ctx.scale(b.facing * BS, BS);
    LINE_K = 2.4; drawBunny(t, 16); LINE_K = 1;
    ctx.restore();
    this._drawKnight();
    if (this.sitting) drawArmchair(false, true);              // 扶手和前腿在骑士前面
    drawHeartParticles(this.hearts);
    ctx.restore();
    // ---- 前景：比中景移动得多 ----
    drawForeground(t, cam);
    ctx.restore();
    // 画面外框
    ctx.beginPath(); ctx.rect(0, 0, VIEW_W, VIEW_H); fs(null, WLW + 1.4);
    ctx.restore();
  },
  _drawKnight(){
    if (this.grounded && !this.sitting){ ell(this.x, this.y, 20, 4.5); fs('rgba(90,70,60,0.18)', 0); }   // 脚下的影子
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.facing * KS * this.sq[0], KS * this.sq[1]);
    LINE_K = 2.5;
    drawKnight({
      t: this.t, sit: this.sitting,
      moving: !this.sitting && this.grounded && Math.abs(this.vx) > 20, phase: this.phase,
      air: this.sitting || this.grounded ? null : (this.vy < 0 ? 'up' : 'down'),
      blinking: this.blink.until > this.t,
      sipW: envelope(this.sip, 0.28, 0.42), cheerW: envelope(this.cheer, 0.28, 0.3),
      look: this.look,
    });
    LINE_K = 1;
    ctx.restore();
  },
};

/* ============================================================
   房子和家具（世界坐标，钢笔淡彩，侧面）
   ============================================================ */
const WLW = 2.2;   // 家具的勾边粗细
const rgbS = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const BOOKS = ['#c96f6a', '#7e9fb0', '#d8b25c', '#8daa86', '#b48ab0', '#e6d6b8'];
function box(x, y, w, h, fill, lw = WLW){ ctx.beginPath(); ctx.rect(x, y, w, h); fs(fill, lw); }

function drawHouse(t, cam){
  const tint = curWash();
  const wall = rgbS(lerpC(PAPER, tint, 0.35)), wainscot = rgbS(lerpC([214, 196, 170], tint, 0.15));
  // 外墙 / 屋顶 / 地基
  box(0, 0, MAP_W, MAP_H, '#5d4636', 0);
  box(WALL_L, CEIL_Y, WALL_R - WALL_L, FLOOR_Y - CEIL_Y, wall, 0);
  // 墙纸竖纹（给镜头移动一个参照）
  for (let x = WALL_L + 30; x < WALL_R; x += 60) line([[x, CEIL_Y], [x, FLOOR_Y]], 'rgba(255,255,255,0.22)', 2);
  // 护墙板：一楼、阁楼
  box(WALL_L, FLOOR_Y - 60, WALL_R - WALL_L, 60, wainscot, 0); line([[WALL_L, FLOOR_Y - 60], [WALL_R, FLOOR_Y - 60]], INKC, 1.6);
  box(MEZZ_X0, MEZZ_Y - 50, WALL_R - MEZZ_X0, 50, wainscot, 0); line([[MEZZ_X0, MEZZ_Y - 50], [WALL_R, MEZZ_Y - 50]], INKC, 1.6);
  // 屋顶木梁 + 每隔一段一根竖梁
  box(0, 0, MAP_W, CEIL_Y, COL.woodDk, 0); line([[WALL_L, CEIL_Y], [WALL_R, CEIL_Y]], INKC, 1.6);
  for (const x of [560, 1400, 2100, 2900]) box(x - 7, CEIL_Y, 14, (x >= MEZZ_X0 ? MEZZ_Y : FLOOR_Y) - CEIL_Y, rgbS(lerpC([180, 140, 105], tint, 0.1)), 1.4);
  // 窗（窗外景色移动得慢 → 显得远）
  drawWindow(1520, 640, 200, 200, t, cam);
  drawWindow(3050, 680, 200, 180, t, cam);
  drawRoundWindow(2700, 380, 52, t, cam);
  // 地板
  box(0, FLOOR_Y, MAP_W, MAP_H - FLOOR_Y, '#c99d71', 0);
  box(0, FLOOR_Y, MAP_W, 6, '#dcbf98', 0);
  for (let x = 30; x < MAP_W; x += 80) line([[x, FLOOR_Y + 6], [x, MAP_H]], 'rgba(120,85,55,0.35)', 1.2);
  line([[0, FLOOR_Y + 24], [MAP_W, FLOOR_Y + 24]], 'rgba(120,85,55,0.3)', 1.1);
  line([[0, FLOOR_Y], [MAP_W, FLOOR_Y]], INKC, WLW);
  // 两头的墙
  box(0, CEIL_Y, WALL_L, FLOOR_Y - CEIL_Y, '#7a5b45', WLW);
  box(WALL_R, CEIL_Y, MAP_W - WALL_R, FLOOR_Y - CEIL_Y, '#7a5b45', WLW);

  drawEntrance();
  drawLibrary();
  drawTeaCorner(t, tint);
  drawStudy(t);
  drawRightEnd(t);
  drawMezzanine(t);
}

/* 窗：窗框 + 窗台；窗外是天、远山、云（跟着镜头只移动一半） */
function drawWindow(x, y, w, h, t, cam){
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = '#cfe2ea'; ctx.fillRect(x, y, w, h);
  ctx.save(); ctx.translate(cam.x * FAR_PAR - x * FAR_PAR, cam.y * FAR_PAR * 0.6 - y * FAR_PAR * 0.6);
  const hx = x - 200, hy = y + h * 0.62;
  smooth([[hx, hy + 200], [hx, hy + 20], [hx + 120, hy - 14], [hx + 230, hy + 10], [hx + 330, hy - 22], [hx + 460, hy + 8], [hx + 600, hy + 200]]); fs('#a9c3b4', 0);
  smooth([[hx, hy + 200], [hx, hy + 52], [hx + 160, hy + 30], [hx + 300, hy + 48], [hx + 600, hy + 34], [hx + 600, hy + 200]]); fs('#8fae9c', 0);
  for (const [cx, cy, r, sp] of [[0, -0.75, 13, 6], [140, -0.45, 9, 4], [260, -0.6, 11, 5]]){
    const xx = hx + ((cx + t * sp) % 600);
    fluffy(xx, hy + cy * h * 0.62, r * 1.6, r * 0.8, 5, 0.25); fs('rgba(255,255,255,0.92)', 0);
  }
  ctx.restore();
  ctx.restore();
  box(x, y, w, h, null, WLW + 1);
  line([[x + w / 2, y], [x + w / 2, y + h]], INKC, WLW); line([[x, y + h / 2], [x + w, y + h / 2]], INKC, WLW);
  box(x - 12, y + h, w + 24, 8, COL.woodLt);   // 窗台（能站）
}
function drawRoundWindow(cx, cy, r, t, cam){
  ctx.save();
  ell(cx, cy, r, r); ctx.clip();
  ctx.fillStyle = '#d6e6ee'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.save(); ctx.translate((cam.x - cx) * FAR_PAR, (cam.y - cy) * FAR_PAR * 0.6);
  for (const [dx, dy, s, sp] of [[-40, -10, 10, 4], [30, 16, 8, 3]]){
    const xx = cx - 120 + ((dx + 120 + t * sp) % 240);
    fluffy(xx, cy + dy, s * 1.6, s * 0.8, 5, 0.25); fs('rgba(255,255,255,0.92)', 0);
  }
  ctx.restore();
  ctx.restore();
  ell(cx, cy, r, r); fs(null, WLW + 2);
  line([[cx - r, cy], [cx + r, cy]], INKC, WLW); line([[cx, cy - r], [cx, cy + r]], INKC, WLW);
}

/* ---------- 门厅：门、衣帽架、鞋凳 ---------- */
function drawEntrance(){
  box(96, 786, 98, 154, '#8a5d3f');                       // 门框
  box(104, 794, 82, 146, COL.wood);
  box(112, 804, 30, 56, COL.woodDk, 1.4); box(148, 804, 30, 56, COL.woodDk, 1.4);
  box(112, 868, 30, 60, COL.woodDk, 1.4); box(148, 868, 30, 60, COL.woodDk, 1.4);
  ell(176, 870, 4, 4); fs('#e2c27a', 1.4);
  smooth([[84, 936], [208, 936], [212, 942], [80, 942]]); fs('#c96f6a', 1.4);   // 门垫
  // 衣帽架：一件粉斗篷、一顶帽子
  line([[272, 940], [272, 800]], INKC, 6); line([[272, 940], [272, 800]], COL.woodDk, 3);
  line([[252, 940], [292, 940]], INKC, 4);
  line([[272, 812], [258, 822]], INKC, 3); line([[272, 812], [288, 822]], INKC, 3);
  smooth([[256, 820], [266, 822], [270, 880], [244, 882]]); fs(COL.pinkHairLt, 1.6);
  ell(290, 828, 12, 5); fs('#7e9fb0', 1.4); ell(290, 822, 7, 6); fs('#7e9fb0', 1.4);
  // 鞋凳（能站）+ 两双鞋
  box(330, 912, 100, 8, COL.woodLt); for (const x of [336, 418]) box(x, 920, 6, 20, COL.woodDk);
  ell(352, 934, 9, 4); fs(COL.armorDk, 1.2); ell(372, 934, 9, 4); fs(COL.armorDk, 1.2);
}

/* ---------- 书房：两个高书架（挑高到屋顶）、小凳、一路往上的置物板、地图 ---------- */
function bookshelf(x0, x1, top){
  box(x0, top, x1 - x0, FLOOR_Y - top, COL.wood);
  box(x0 + 8, top + 10, x1 - x0 - 16, FLOOR_Y - top - 18, COL.woodDk, 0);
  for (let y = top + 10, row = 0; y + 54 < FLOOR_Y; y += 54, row++){
    for (let i = 0, x = x0 + 12; x < x1 - 20; i++){
      const w = 9 + ((i + row) * 5) % 6, h = 30 + ((i + row) * 7) % 12;
      box(x, y + 48 - h, w, h, BOOKS[(i + row) % BOOKS.length], 1.3);
      x += w + 2;
    }
    box(x0 + 4, y + 48, x1 - x0 - 8, 5, COL.woodLt, 1.4);
  }
  box(x0 - 4, top - 4, x1 - x0 + 8, 8, COL.woodLt);   // 顶板（能站）
}
function wallShelf(x0, x1, y, item){
  box(x0, y, x1 - x0, 7, COL.woodLt);
  for (const x of [x0 + 10, x1 - 14]){ smooth([[x, y + 7], [x + 4, y + 7], [x + 4, y + 18]]); fs(COL.woodDk, 1.6); }   // 托架
  if (item === 'books'){ box(x1 - 30, y - 22, 8, 22, '#7e9fb0', 1.4); box(x1 - 21, y - 18, 7, 18, '#d8b25c', 1.4); }
  else if (item === 'cactus'){ smooth([[x1 - 22, y], [x1 - 8, y], [x1 - 10, y - 10], [x1 - 20, y - 10]]); fs('#c98a62', 1.4); ell(x1 - 15, y - 17, 5, 8); fs('#8fb08a', 1.4); }
  else if (item === 'bell'){ smooth([[x1 - 34, y], [x1 - 14, y], [x1 - 18, y - 16], [x1 - 30, y - 16]]); fs('#e2c27a', 1.6); ell(x1 - 24, y - 18, 3, 3); fs('#e2c27a', 1.2); }
}
function drawLibrary(){
  bookshelf(640, 760, 700);
  bookshelf(980, 1100, 650);
  box(860, 900, 50, 8, COL.woodLt); box(866, 908, 6, 32, COL.woodDk); box(898, 908, 6, 32, COL.woodDk);   // 小凳
  wallShelf(790, 860, 820, 'books');
  wallShelf(870, 950, 740, 'cactus');
  wallShelf(1120, 1200, 570, 'books');
  wallShelf(1220, 1300, 480, 'cactus');
  wallShelf(1300, 1380, 400, 'bell');   // 最高处的小铃铛（以后可以当个小彩蛋）
  // 墙上的手绘地图
  box(1180, 700, 130, 90, '#f3e7c9', 1.8);
  line([[1196, 760], [1226, 730], [1256, 748], [1292, 716]], '#8daa86', 2.6);
  ell(1240, 744, 6, 4); fs('#7e9fb0', 1.2); line([[1200, 720], [1214, 720]], '#c96f6a', 2);
}

/* ---------- 茶室：窗、木椅（原画那把，离书架远一点）、茶几、地毯、小画 ---------- */
function drawArmchair(back, front){
  const x0 = CHAIR_SEAT.x0, y = CHAIR_SEAT.y;
  if (back){
    box(x0 - 8, y - 58, 16, 70, COL.wood);            // 椅背
    box(x0 - 4, y - 50, 8, 52, COL.woodDk, 0);
    ell(x0, y - 60, 12, 5); fs(COL.woodLt);
    box(x0 - 6, y + 4, 8, FLOOR_Y - y - 4, COL.woodDk);   // 后腿
    box(x0, y - 2, 68, 8, COL.wood);                  // 椅座
  }
  if (front){
    box(x0 - 4, y - 18, 72, 6, COL.wood);             // 扶手
    box(x0 + 58, y - 14, 9, FLOOR_Y - y + 14, COL.woodDk);   // 前腿
  }
}
function drawTeaCorner(t, tint){
  smooth([[1786, FLOOR_Y - 3], [2066, FLOOR_Y - 3], [2070, FLOOR_Y + 2], [1782, FLOOR_Y + 2]]); fs(rgbS(tint), 1.6);   // 地毯（主题色）
  // 墙上的兔子小画
  box(1770, 720, 40, 48, '#f7f1e3');
  ell(1790, 746, 10, 9); fs(COL.bunny, 1.4); ell(1786, 734, 3, 8, -0.3); fs(COL.bunnyEar, 1.2); ell(1794, 734, 3, 8, 0.2); fs(COL.bunnyEar, 1.2);
  // 茶几 + 茶壶 + 杯子
  for (const x of [1930, 2006]) box(x, 918, 6, FLOOR_Y - 918, COL.woodDk);
  box(1918, 910, 104, 8, COL.woodLt);
  ell(1966, 901, 13, 10); fs('#f7f3ea', 1.8); ell(1966, 891, 4, 2); fs('#d9cdb8', 1.4);
  line([[1978, 900], [1987, 893]], INKC, 4); line([[1978, 900], [1987, 893]], '#f7f3ea', 2);
  box(1934, 902, 9, 8, COL.mugPink, 1.4); box(1996, 902, 9, 8, '#fdfdfb', 1.4);
  const ph = (t * 0.5) % 1;
  line([[1966, 884 - ph * 14], [1969, 878 - ph * 14], [1966, 872 - ph * 14]], `rgba(58,42,40,${Math.sin(ph * Math.PI) * 0.4})`, 1.6);
  // 通往阁楼的一排置物板
  wallShelf(2120, 2200, 860, 'books');
  wallShelf(2230, 2310, 780);
  wallShelf(2120, 2200, 700, 'cactus');
  wallShelf(2230, 2310, 620);
}

/* ---------- 工作间：书桌、电脑（显示器里在下雨）、转椅、软木板、挂钟（真实时间） ---------- */
function drawStudy(t){
  // 软木板 + 便签
  box(2370, 680, 100, 76, '#c9a27a', 1.8);
  for (const [x, y, c] of [[2380, 690, '#f7e98e'], [2410, 702, '#f9cdcf'], [2440, 688, '#cfe2ea'], [2392, 722, '#d6e9c9']]){
    box(x, y, 20, 18, c, 1.2); ell(x + 10, y + 2, 2, 2); fs('#c96f6a', 0);
  }
  // 挂钟：真实时间
  const now = new Date(), cx = 2610, cy = 660;
  ell(cx, cy, 18, 18); fs('#fbf6ea', 2);
  const hr = (now.getHours() % 12 + now.getMinutes() / 60) / 12 * TAU, mn = (now.getMinutes() + now.getSeconds() / 60) / 60 * TAU;
  line([[cx, cy], [cx + Math.sin(hr) * 9, cy - Math.cos(hr) * 9]], INKC, 2.6);
  line([[cx, cy], [cx + Math.sin(mn) * 13, cy - Math.cos(mn) * 13]], INKC, 1.8);
  // 转椅（能站）
  box(2402, 897, 50, 8, '#7e9fb0'); box(2402, 860, 8, 40, '#7e9fb0');
  line([[2427, 905], [2427, 928]], INKC, 3); line([[2410, 934], [2444, 934]], INKC, 3);
  ell(2412, 936, 3, 3); fs(INKC, 0); ell(2442, 936, 3, 3); fs(INKC, 0);
  // 书桌（能站）
  for (const x of [2484, 2690]) box(x, 878, 8, FLOOR_Y - 878, COL.woodDk);
  box(2560, 878, 130, 22, COL.wood); ell(2625, 889, 4, 2.5); fs(COL.woodLt, 1.2);
  box(2474, 868, 232, 10, COL.woodLt);
  // 主机（桌下）
  box(2496, 884, 26, 56, '#d9dde6'); ell(2509, 896, 3, 3); fs('#9fd38e', 0); line([[2502, 910], [2516, 910]], '#9aa3b5', 1.4);
  // 显示器 + 屏幕（里面在下雨 —— 听雨）
  box(2534, 856, 22, 6, '#9aa3b5', 1.6); box(2541, 842, 8, 16, '#9aa3b5', 1.6);
  box(2510, 790, 70, 52, '#3f4654', 2.2);
  ctx.save(); ctx.beginPath(); ctx.rect(2515, 795, 60, 42); ctx.clip();
  ctx.fillStyle = '#2f4a5c'; ctx.fillRect(2515, 795, 60, 42);
  for (let i = 0; i < 12; i++){
    const rx = 2515 + ((i * 37) % 60), ry = 795 + ((t * 60 + i * 23) % 50) - 6;
    line([[rx, ry], [rx - 2, ry + 6]], 'rgba(200,225,240,0.7)', 1.1);
  }
  if ((t % 1) < 0.5) box(2520, 828, 5, 2, '#e8f1f5', 0);   // 闪烁的光标
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(2510, 842); ctx.lineTo(2580, 842); ctx.lineTo(2620, 940); ctx.lineTo(2470, 940); ctx.closePath();
  fs('rgba(190,220,240,0.10)', 0);   // 屏幕的光
  // 键盘 + 鼠标 + 台灯
  box(2590, 862, 40, 6, '#e6e9ef', 1.4); ell(2642, 865, 5, 3); fs('#e6e9ef', 1.2);
  line([[2688, 868], [2688, 830]], INKC, 2.4);
  smooth([[2674, 834], [2702, 834], [2694, 818], [2682, 818]]); fs('#efd9a0', 1.8);
  ell(2688, 838, 20, 6); fs(`rgba(255,236,170,${0.25 + Math.sin(t * 2) * 0.05})`, 0);
  // 矮书柜（能站）
  box(2756, 860, 108, FLOOR_Y - 860, COL.wood);
  box(2764, 868, 92, 32, COL.woodDk, 0); box(2764, 904, 92, 30, COL.woodDk, 0);
  for (let i = 0, x = 2768; i < 7; i++){ const w = 9 + (i * 3) % 4; box(x, 872, w, 26, BOOKS[i % BOOKS.length], 1.2); x += w + 2; }
  box(2752, 856, 116, 8, COL.woodLt);
}

/* ---------- 右边：大窗旁边的落地灯、坐垫、盆栽 ---------- */
function drawRightEnd(t){
  line([[3420, 940], [3420, 820]], INKC, 3.4); line([[3404, 940], [3436, 940]], INKC, 3.4);
  smooth([[3398, 826], [3442, 826], [3432, 796], [3408, 796]]); fs('#f3e3b8', 1.8);
  ell(3420, 834, 30, 10); fs(`rgba(255,236,170,${0.22 + Math.sin(t * 1.7) * 0.04})`, 0);
  ell(3300, 932, 30, 9); fs(COL.pinkHairLt, 1.6); ell(3340, 934, 26, 8); fs('#cfe2ea', 1.6);
  smooth([[3480, 900], [3520, 900], [3516, 940], [3484, 940]]); fs('#c98a62', WLW);
  for (const [a, l] of [[-0.6, 50], [-0.2, 64], [0.3, 56]]){
    ctx.save(); ctx.translate(3500, 900); ctx.rotate(a + Math.sin(t * 1.1) * 0.04);
    ell(0, -l / 2, 10, l / 2); fs('#8fb08a', 1.6); ctx.restore();
  }
}

/* ---------- 阁楼：木地板（单向平台）、床、纸箱、小灯笼 ---------- */
function drawMezzanine(t){
  box(MEZZ_X0, MEZZ_Y, WALL_R - MEZZ_X0, 16, COL.woodLt);
  for (let x = MEZZ_X0 + 60; x < WALL_R; x += 120){ smooth([[x, MEZZ_Y + 16], [x + 10, MEZZ_Y + 16], [x + 10, MEZZ_Y + 34]]); fs(COL.woodDk, 1.6); }
  // 栏杆（阁楼左边的开口）
  for (let x = MEZZ_X0 + 4; x < MEZZ_X0 + 64; x += 14) line([[x, MEZZ_Y], [x, MEZZ_Y - 36]], COL.woodDk, 3);
  box(MEZZ_X0, MEZZ_Y - 40, 66, 6, COL.wood);
  // 床（能站）：床头、被子、枕头
  box(3150, 470, 12, 90, COL.wood);
  box(3150, 520, 210, 22, COL.woodLt);
  for (const x of [3156, 3350]) box(x, 542, 8, 18, COL.woodDk);
  smooth([[3168, 520], [3352, 520], [3356, 506], [3240, 500], [3168, 508]]); fs(COL.pinkHairLt, 1.8);
  ell(3186, 508, 20, 9); fs('#fdfbf6', 1.6);
  // 纸箱（能站）
  box(2400, 520, 60, 40, '#d9b48a'); line([[2400, 532], [2460, 532]], '#b48a62', 2);
  box(2460, 480, 52, 80, '#cfa77c'); line([[2460, 494], [2512, 494]], '#b48a62', 2);
  // 小灯笼
  line([[2900, CEIL_Y], [2900, 300]], INKC, 1.6);
  ell(2900, 318, 14, 18); fs('#f0a75a', 1.8);
  ell(2900, 318, 26, 26); fs(`rgba(255,200,120,${0.12 + Math.sin(t * 2.4) * 0.04})`, 0);
  // 一摞书 + 小地毯
  box(2980, 540, 30, 8, '#7e9fb0', 1.3); box(2984, 532, 24, 8, '#d8b25c', 1.3); box(2982, 524, 28, 8, '#c96f6a', 1.3);
  smooth([[2620, MEZZ_Y - 2], [2820, MEZZ_Y - 2], [2824, MEZZ_Y + 2], [2616, MEZZ_Y + 2]]); fs('#b48ab0', 1.4);
}

/* ============================================================
   前景（离镜头最近）：移动比中景快 FG_PAR 倍；颜色深一点
   位置按「镜头正对着它时它在哪」来摆
   ============================================================ */
function drawForeground(t, cam){
  const at = (wx, wy) => [(wx - cam.x) + (wx - cam.x - VIEW_W / 2) * FG_PAR, (wy - cam.y) + (wy - cam.y - VIEW_H / 2) * FG_PAR * 0.4];
  // 藤蔓（从屋顶垂下）
  for (const [wx, wy, n] of [[300, CEIL_Y, 7], [1180, CEIL_Y, 6], [3000, CEIL_Y, 8], [2050, MEZZ_Y + 16, 5]]){
    const [x, y] = at(wx, wy);
    if (x < -80 || x > VIEW_W + 80) continue;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 0.9 + wx) * 0.03);
    const pts = [[0, 0]]; for (let i = 1; i <= n; i++) pts.push([Math.sin(i * 1.3 + wx) * 8, i * 20]);
    line(pts, '#4f6e4c', 3);
    pts.slice(1).forEach(([px, py], i) => { ell(px + (i % 2 ? 7 : -7), py, 10, 5.5, i % 2 ? 0.5 : -0.5); fs('#6d8f69', 1.6); });
    ctx.restore();
  }
  // 深色的木柱（分隔区域，镜头经过时从眼前滑过）
  for (const wx of [1400, 2980]){
    const [x] = at(wx, 0);
    if (x < -80 || x > VIEW_W + 80) continue;
    box(x - 18, -20, 36, VIEW_H + 40, 'rgba(78,58,44,0.92)', 2.4);
    line([[x - 8, -20], [x - 8, VIEW_H + 20]], 'rgba(255,255,255,0.08)', 4);
  }
  // 大盆栽（地上）
  for (const wx of [600, 2340, 3180]){
    const [x, y] = at(wx, FLOOR_Y);
    if (x < -100 || x > VIEW_W + 100) continue;
    ctx.save(); ctx.translate(x, y + 20);
    for (const [a, l] of [[-0.8, 70], [-0.35, 92], [0.1, 84], [0.5, 66], [-0.1, 56]]){
      ctx.save(); ctx.rotate(a + Math.sin(t * 1.2 + wx) * 0.05); ell(0, -l / 2, 16, l / 2); fs('#5f805b', 1.8); line([[0, -2], [0, -l + 6]], '#4a6747', 1.4); ctx.restore();
    }
    smooth([[-28, -6], [28, -6], [24, 40], [-24, 40]]); fs('#8f5f3e', WLW);
    ctx.restore();
  }
}
