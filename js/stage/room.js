"use strict";
/* ============================================================
   room.js：横版 2D 地图（空洞骑士那种纯侧面）—— 一栋两层的小房子，镜头锁定骑士
   ------------------------------------------------------------
   A / D 左右走；空格跳（按得越久跳得越高），空中再按一次 = 二段跳；站在家具上按 S 跳下来；
   E 互动（接口留好了，目前没有任何互动）；W 先空着（以后进门 / 上楼梯）
   一开始骑士坐在他那把木椅上（原画的姿势），一动就站起来
   动画状态：SIT / IDLE / MOVE / JUMP / FALL / LAND（帧在 sprites.js），落地扬起灰尘
   家具的顶面都是「单向平台」：从下面能穿上去，从上面落下能站住（阁楼的木地板也是）
   镜头：平滑跟随骑士、朝他走的方向多看一点、到地图边缘停住
   视差：窗外的景色移动得慢（远），前景的柱子 / 植物移动得快（近）→ 2.5D 的深度
   像素风：房子画在低分辨率画布上（1 像素 = 2 世界单位，house.js），整数倍放大；
          人物和前景直接画在屏幕上，位置对齐到屏幕像素 → 镜头移动时也是平滑的
   ------------------------------------------------------------
   地图（世界坐标）3600 × 1000，约 4 屏宽、2 屏高；地板 y = 940，阁楼地板 y = 560
   像素坐标就是世界坐标 ÷ 2：1800 × 500，镜头 448 × 252
   一楼从左到右：门厅 → 书房（两个高书架，挑高到屋顶）→ 茶室（窗、木椅、茶几）→ 工作间（书桌、电脑）→ 大窗
   二楼阁楼（x 2100–3560）：床、圆窗、纸箱；从茶室旁边的一排置物板跳上去
   ============================================================ */

const MAP_W = 3600, MAP_H = 1000, FLOOR_Y = 940, MEZZ_Y = 560, MEZZ_X0 = 2100;
const WALL_L = 40, WALL_R = 3560, CEIL_Y = 20;
const VIEW_W = 896, VIEW_H = 504;      // 镜头看到的范围（世界单位，16:9）
const KH = 95, KHW = 15;               // 骑士的高 / 半宽（碰撞用；像素图约 26 × 52 像素）
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
const CHAIR_SEAT = plat('木椅', 1802, 1848, 916);
const PERCH = [1806, 824];             // 骑士坐着时，兔耳小鸟停在椅背顶上
plat('茶几', 1920, 2020, 910);
for (const [x0, x1, y] of [[2120, 2200, 860], [2230, 2310, 780], [2120, 2200, 700], [2230, 2310, 620]]) plat('置物板', x0, x1, y);
plat('转椅', 2400, 2452, 904);
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
  landT: 0,                         // 刚落地：蹲一下
  phase: 0,
  keys: new Set(),
  blink: { at: 1.6, until: 0 },
  cheer: -1, cheered: false,
  cam: { x: 0, y: 0 }, lookAhead: 0, camReady: false,
  bunny: { x: 1800, y: 860, facing: 1, jump: -1 },
  hearts: [], puffs: [], feathers: [], puffAcc: 0,
  s: 1, k: 2, kd: 2, ox: 0, oy: 0,

  /* ---------- 布局：镜头画面居中在舞台可用区域，最大 1 倍；
     一个像素放大成整数个屏幕像素（kd），像素才是方方正正、一样大的 ---------- */
  layout(){
    const aw = Math.max(240, W - insetR);
    const s = Math.max(0.3, Math.min(1, aw * 0.9 / VIEW_W, (H - 200) / VIEW_H));
    this.kd = Math.max(1, Math.floor(s * PX * DPR + 1e-6));
    this.k = this.kd / DPR;            // 一个像素在屏幕上多宽（CSS 像素）
    this.s = this.k / PX;              // 世界单位 → CSS 像素
    const snap = v => Math.round(v * DPR) / DPR;
    this.ox = snap(CX - VIEW_W / 2 * this.s);
    this.oy = snap(Math.max(80, (H - 110 - VIEW_H * this.s) / 2 + 20));
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
    this.sitting = false;
    this.grounded = false; this.ground = null; this.airJumps = AIR_JUMPS;
    this.vy = -230; this.vx = (dir || 1) * 70;
    this.drop = CHAIR_SEAT; this.dropUntil = this.t + 0.4;
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
  /* 开心：眯眼笑 ^ ^、站着的话原地蹦一下、冒爱心 */
  doCheer(){
    if (this.cheer >= 0 && this.cheer < 0.5) return;
    this.cheer = 0; this.cheered = false;
    if (this.grounded && !this.sitting){ this.vy = -300; this.grounded = false; this.ground = null; }
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
    }
    if (!this.sitting) this._physics(dt, dir);
    this.landT = Math.max(0, this.landT - dt);
    // 走路节奏 / 小灰尘
    const walking = !this.sitting && this.grounded && Math.abs(this.vx) > 20;
    this.walking = walking;
    if (walking){
      this.phase += dt * 11 * Math.abs(this.vx) / RUN;
      if ((this.puffAcc += dt) > 0.22){ this.puffAcc = 0; this._dust(this.x - this.facing * 9, this.y, 1, 2); }
    } else this.phase = 0;
    // 眨眼
    if (t >= this.blink.at){ this.blink.until = t + 0.13; this.blink.at = t + (Math.random() < 0.2 ? 0.28 : rnd(2.5, 5.5)); }
    // 开心：到 0.3 时「叮」+ 冒爱心
    if (this.cheer >= 0){
      this.cheer += dt / 1.3;
      if (!this.cheered && this.cheer >= 0.3){
        this.cheered = true; clink();
        this._burst(this.x + this.facing * 8, this.y - 100, 5);
      }
      if (this.cheer > 1) this.cheer = -1;
    }
    // 兔耳小鸟：在骑士身后上方飞着跟随；骑士坐着时停在椅背顶上
    const b = this.bunny;
    const [tx, ty] = this.sitting ? PERCH : [this.x - this.facing * 48, this.y - 96];
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
      this._dust(this.x, this.y, 1, 4);
    } else if (this.jumpBuf > 0 && !this.grounded && this.airJumps > 0){
      // 二段跳：空中再蹬一下，脚下散开一圈小羽毛
      this.airJumps--; this.jumpBuf = 0;
      this.vy = -AIR_JUMP_V;
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
      this.landT = 0.06 + 0.08 * k;
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
    const t = this.t, k = this.k, kd = this.kd;
    const VW = VIEW_W / PX, VH = VIEW_H / PX;               // 448 × 252 像素
    const q = v => Math.round(v * kd) / kd;                  // 对齐到屏幕像素
    const camX = q(this.cam.x / PX), camY = q(this.cam.y / PX);
    const ix = Math.floor(camX), iy = Math.floor(camY);
    // 1) 低分辨率画布（多 1 像素给镜头的小数部分）：远景 + 房子 + 会动的小东西
    if (!LO) LO = pxCanvas(VW + 1, VH + 1);
    const g = LO.getContext('2d');
    g.clearRect(0, 0, VW + 1, VH + 1);
    drawFar(g, t, ix, iy, VW + 1, VH + 1);
    drawHouseLayer(g, ix, iy, VW + 1, VH + 1);
    drawHouseLive(g, t, ix, iy);
    // 2) 画框 + 整数倍放大贴到屏幕上（镜头的小数部分用屏幕像素来挪 → 平滑）
    drawViewFrame(this.ox, this.oy, VW * k, VH * k, k);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.beginPath(); ctx.rect(this.ox, this.oy, VW * k, VH * k); ctx.clip();
    ctx.drawImage(LO, this.ox - (camX - ix) * k, this.oy - (camY - iy) * k, (VW + 1) * k, (VH + 1) * k);
    // 3) 人物和粒子：以像素为单位，直接画在屏幕上
    ctx.save();
    ctx.translate(this.ox - camX * k, this.oy - camY * k);
    ctx.scale(k, k);
    this._drawPuffs(q);
    this._drawFeathers(q);
    this._drawBunny(q);
    this._drawKnight(q);
    if (this.sitting) ctx.drawImage(CHAIR_FRONT.c, CHAIR_FRONT.x, CHAIR_FRONT.y);   // 扶手和前腿在骑士前面
    this._drawHearts(q);
    ctx.restore();
    // 4) 前景：比中景移动得多
    ctx.translate(this.ox, this.oy);
    ctx.scale(k, k);
    drawForeground(ctx, t, camX, camY, q);
    ctx.restore();
  },
  /* 现在是哪个动作（帧在 sprites.js 的 KF 里） */
  _pose(){
    if (this.sitting) return 'sit';
    if (!this.grounded) return this.vy < 0 ? 'jump' : 'fall';
    if (this.landT > 0) return 'land';
    if (this.walking) return 'walk' + (Math.floor(this.phase / (Math.PI / 4)) % 8);   // 8 帧，满速约 14 帧/秒
    return (this.t % 1.6) < 0.8 ? 'idle' : 'breathe';
  },
  _drawKnight(q){
    const pose = this._pose(), eye = this.cheer >= 0 ? 'happy' : (this.blink.until > this.t ? 'blink' : 'open');
    const f = KF[eye][pose], flip = this.facing < 0;
    const x = q(this.x / PX), y = q(this.y / PX);
    if (this.grounded && !this.sitting){   // 脚下的影子
      ctx.fillStyle = 'rgba(70,45,35,0.22)';
      ctx.fillRect(x - 9, y, 18, 1); ctx.fillRect(x - 6, y + 1, 12, 1);
    }
    ctx.drawImage(flip ? f.l : f.r, x - (flip ? KW - K_AX : K_AX), y - f.h + (K_DY[pose] || 0));
  },
  _drawBunny(q){
    const b = this.bunny, t = this.t;
    const perched = this.sitting && Math.hypot(b.x - PERCH[0], b.y - PERCH[1]) < 4;
    const hop = b.jump >= 0 ? Math.round(Math.sin(b.jump * Math.PI) * 7) : 0;
    const bob = perched ? 0 : Math.round(Math.sin(t * 3) * 2);
    const fr = BUNNY[perched ? 0 : Math.floor(t * 9) % 2];
    ctx.drawImage(b.facing > 0 ? fr.r : fr.l, q(b.x / PX) - 7, q(b.y / PX) - 6 - hop + bob);
  },
  _drawPuffs(q){
    for (const p of this.puffs){
      const f = p.t / 0.5, x = q(p.x / PX), y = q(p.y / PX);
      if (p.ring){ pxEllipse(x, y - 1, 5 + f * 20, 2 + f * 5, `rgba(255,255,255,${0.9 * (1 - f)})`); continue; }
      const r = (p.big ? 3 : 2) + Math.floor(f * 3);
      ctx.fillStyle = `rgba(150,130,110,${0.45 * (1 - f)})`;
      for (let dy = -Math.ceil(r * 0.6); dy <= 0; dy++){
        const w = Math.round(r * Math.sqrt(1 - (dy / (r * 0.6 + 0.5)) ** 2));
        ctx.fillRect(x - w, y - 1 - Math.floor(f * 2) + dy, w * 2 + 1, 1);
      }
    }
  },
  _drawFeathers(q){
    for (const f of this.feathers){
      if (f.t / f.life > 0.6 && Math.floor(f.t * 20) % 2) continue;   // 快消失时一闪一闪
      const s = FEATHERS[((Math.round(f.rot / (Math.PI / 4)) % 4) + 4) % 4], c = f.pink ? s.p : s.w;
      ctx.drawImage(c, q(f.x / PX) - (c.width >> 1), q(f.y / PX) - (c.height >> 1));
    }
  },
  _drawHearts(q){
    for (const p of this.hearts){
      if (p.life - p.t < 0.35 && Math.floor(p.t * 16) % 2) continue;
      ctx.drawImage(HEART, q(p.x / PX) - 3, q(p.y / PX) - 3);
    }
  },
};

let LO = null;   // 低分辨率画布（镜头看到的那一块）
/* 像素椭圆的边（双击跳时脚下散开的那一圈） */
function pxEllipse(cx, cy, rx, ry, col){
  ctx.fillStyle = col;
  const n = Math.ceil(TAU * Math.max(rx, ry)), seen = new Set();
  for (let i = 0; i < n; i++){
    const a = i / n * TAU, x = Math.round(Math.cos(a) * rx), y = Math.round(Math.sin(a) * ry), key = x * 1000 + y;
    if (seen.has(key)) continue;
    seen.add(key); ctx.fillRect(cx + x, cy + y, 1, 1);
  }
}
