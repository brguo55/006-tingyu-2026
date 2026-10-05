"use strict";
/* ============================================================
   knight.js：粉发骑士（照着约稿的原画，用代码重画成能动的部件）+ 粉色兔耳小鸟 + 爱心
   ------------------------------------------------------------
   drawKnight(k)：以脚底中点为原点、面朝右画（往左走时外面整体镜像）
     IDLE：呼吸起伏、眨眼、头发轻晃、杯子冒热气、站久了喝一口
     MOVE：两腿交替迈步、身体上下颠、后手摆动、头微微前倾
     JUMP：起跳收腿、后手扬起；FALL：腿垂下微微分开（k.air = 'up' / 'down'）
     SIT：坐在椅子上（原画的姿势）—— 大腿平放、小腿垂下、后手搭在扶手上（k.sit）
   头部沿用原画坐标（脖子在原画里的 (470, 705)）
   ============================================================ */

const INKC = 'rgb(58,42,40)';
const COL = {
  skin: '#fde8dc', blush: 'rgba(240,150,150,0.28)',
  pinkHair: '#f2a2a9', pinkHairLt: '#f9cdcf', pinkHairDk: '#de8590',
  armor: '#c6cde0', armorDk: '#939dba', armorLt: '#eceff7',
  tunic: '#e0e9a3', tunicDk: '#bccb76',
  wood: '#a9774f', woodDk: '#7f5437', woodLt: '#c99d71',
  mugPink: '#f3a9b2', mugPinkDk: '#d98591',
  mouth: '#ea7d7e', mouthDk: '#c25556',
  heart: '#e6646d', bunny: '#f4abb6', bunnyDk: '#dd8997', bunnyEar: '#fdf3f3', beak: '#f0b85a',
};
const LW = 3.4;      // 钢笔勾边粗细（画骑士时的局部坐标里）
let LINE_K = 1;      // 勾边加粗倍数：小人缩得很小时加粗，线条才不会细得看不见

/* ---------- 画形状的小工具（都在当前变换下） ---------- */
function fs(fill, lw = LW){
  if (fill){ ctx.fillStyle = fill; ctx.fill(); }
  if (lw){ ctx.strokeStyle = INKC; ctx.lineWidth = lw * LINE_K; ctx.stroke(); }
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
  ctx.strokeStyle = INKC; ctx.lineWidth = lw * 2 * LINE_K;
  for (const b of builders){ b(); ctx.stroke(); }
  ctx.fillStyle = fill;
  for (const b of builders){ b(); ctx.fill(); }
}
function line(pts, color = INKC, w = LW){ smooth(pts, false); ctx.strokeStyle = color; ctx.lineWidth = w * LINE_K; ctx.stroke(); }
/* 粗胶囊（手臂）：先描墨边再填色 */
function capsule(a, b, w, fill){
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
  ctx.strokeStyle = INKC; ctx.lineWidth = w + LW * 2 * LINE_K; ctx.stroke();
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

/* ============================================================
   粉发骑士
   k = { t, moving, phase, air, sit, blinking, sipW, cheerW, look:[dx,dy] }
   ============================================================ */
const NECK_Y = -170;   // 脖子离脚底的高度

function drawKnight(k){
  const { t, moving, phase, sipW, cheerW, air, sit } = k;
  const bob = air ? 0 : moving ? -Math.abs(Math.sin(phase)) * 9 : Math.sin(t * 2.1) * 2.2;
  const swing = air === 'up' ? -0.9 : air === 'down' ? 0.5 : moving ? Math.sin(phase) : 0;

  // 坐着：大腿平放、小腿垂下（两条腿前后错开一点）
  if (sit) for (const [dx, dy] of [[-6, -6], [0, 0]]){
    capsule([-4 + dx, -60 + dy], [38 + dx, -60 + dy], 30, COL.armor);
    capsule([38 + dx, -60 + dy], [42 + dx, -12 + dy], 28, COL.armor);
    ell(38 + dx, -60 + dy, 15, 13); fs(COL.armorLt, 2.4);
    ell(48 + dx, -6 + dy, 24, 10); fs(COL.armorDk);
  }
  // 腿：两只银色护胫，走路时前后交替、抬脚；起跳时收腿，下落时垂下分开
  if (!sit) for (const ph of [Math.PI, 0]){
    const back = !!ph;
    let sw = moving ? Math.sin(phase + ph) * 14 : 0;
    let lift = moving ? Math.max(0, Math.cos(phase + ph)) * 10 : 0;
    if (air === 'up'){ sw = back ? -8 : 12; lift = back ? 16 : 24; }
    if (air === 'down'){ sw = back ? -9 : 9; lift = -3; }
    const lx = back ? -22 : 22;
    smooth([[lx - 17 + sw, -66], [lx + 17 + sw, -66], [lx + 17 + sw, -8 - lift], [lx - 17 + sw, -8 - lift]]); fs(COL.armor);
    ell(lx + sw, -60, 16, 8); fs(COL.armorLt, 2.4);
    ell(lx + sw + 5, -4 - lift, 24, 10); fs(COL.armorDk);
  }
  // 后手（在身后摆动）
  const armUp = air === 'up' ? -34 : air === 'down' ? -20 : 0;   // 空中后手扬起保持平衡
  const backHand = sit ? [-36, -84 + bob] : [-60 - swing * 14, -100 + bob + armUp];   // 坐着时搭在扶手上
  capsule([-40, -146 + bob], backHand, 26, COL.armor);
  ell(backHand[0], backHand[1], 11, 10); fs(COL.armorLt);
  // 身体：银甲 + 身前垂下的黄绿色布片
  smooth([[-62, -172 + bob], [60, -174 + bob], [80, -112 + bob], [70, -60 + bob], [-62, -58 + bob], [-80, -110 + bob]]); fs(COL.armor);
  for (const y of [-140, -112, -86]) line([[-62, y + bob], [2, y + 5 + bob], [64, y - 2 + bob]], COL.armorDk, 3);
  line([[-62, -150 + bob], [-70, -88 + bob]], COL.armorLt, 6);
  ctx.save();
  ctx.translate(0, -80 + bob); ctx.rotate(swing * 0.06); ctx.translate(0, 80 - bob);
  if (sit){   // 坐着：布片盖在腿上，往前垂
    smooth([[-48, -82 + bob], [52, -84 + bob], [66, -66 + bob], [70, -40 + bob], [36, -34 + bob], [-44, -46 + bob]]); fs(COL.tunic);
    line([[10, -70 + bob], [30, -40 + bob]], COL.tunicDk, 3);
  } else {
    smooth([[-48, -82 + bob], [52, -84 + bob], [60, -34 + bob], [54, -6 + bob], [-44, -6 + bob], [-52, -34 + bob]]); fs(COL.tunic);
    line([[-12, -70 + bob], [-10, -14 + bob]], COL.tunicDk, 3); line([[24, -72 + bob], [28, -14 + bob]], COL.tunicDk, 3);
  }
  line([[-48, -78 + bob], [52, -80 + bob]], COL.tunicDk, 4);
  ctx.restore();
  ell(8, -168 + bob, 52, 15); fs(COL.tunic);            // 领口

  // 头（以脖子为轴：平时微晃，走路时微微前倾，喝茶时低头）
  ctx.save();
  ctx.translate(0, NECK_Y + bob);
  ctx.rotate((moving ? 0.05 + Math.sin(phase * 2) * 0.02 : Math.sin(t * 1.1) * 0.035) - sipW * 0.06);
  drawKnightHead(k);
  ctx.restore();

  // 前手 + 粉色杯子（最上层：喝茶时杯子在脸前）
  const shoulder = [46, -142 + bob];
  let hand = lerp2([84, -112 + bob], [100, -236 + bob], cheerW);   // 举杯
  hand = lerp2(hand, [90, -186 + bob], sipW);                       // 喝一口
  capsule(shoulder, hand, 30, COL.armor);
  drawMug(hand[0] + 16, hand[1] - 6, -0.75 * sipW, sipW < 0.15 && cheerW < 0.2, t);
  ell(hand[0], hand[1], 12, 11); fs(COL.armorLt);
}

/* 头：原画坐标（脖子 = (470, 705)），调用前原点已经在脖子上 */
function drawKnightHead(k){
  const { sipW, cheerW, blinking, look } = k;
  ctx.save();
  ctx.translate(-470, -705);
  // 后面一大团卷发
  union([
    () => fluffy(456, 528, 160, 140, 9, 0.24, -0.25),
    () => fluffy(344, 618, 76, 52, 5, 0.3, 0.6),
    () => fluffy(566, 480, 84, 66, 6, 0.24, 0.1),
    () => smooth([[300, 600], [330, 640], [312, 690], [290, 676], [286, 630]]),   // 左下垂下的一绺
  ], COL.pinkHair);
  // 发丝走向（深一点的粉）+ 高光
  for (const st of [[[350, 470], [330, 520], [338, 566]], [[410, 420], [388, 470], [392, 520]], [[480, 396], [470, 440]],
                    [[300, 620], [304, 662]], [[560, 440], [584, 470]]]) line(st, COL.pinkHairDk, 3.4);
  line([[384, 446], [420, 420], [462, 410]], COL.pinkHairLt, 8);
  line([[318, 598], [346, 588]], COL.pinkHairLt, 6);
  line([[560, 430], [596, 440]], COL.pinkHairLt, 6);
  // 呆毛：一绺翘起来
  line([[478, 392], [486, 360], [512, 344], [530, 356]], INKC, LW + 4);
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
  // 眉毛（有点认真）、眼睛、嘴
  line([[508, 598], [538, 607]], INKC, 4.2); line([[562, 609], [592, 602]], INKC, 4.2);
  drawEyes([[526, 632], [582, 638]], look, blinking, sipW > 0.5 || cheerW > 0.6, 10, 17);
  if (sipW > 0.4) line([[545, 684], [558, 689], [571, 684]], INKC, 3.2);
  else { smooth([[541, 676], [575, 676], [571, 692], [558, 699], [545, 692]]); fs(COL.mouth, 3); ell(558, 692, 8, 4); fs(COL.mouthDk, 0); }
  ctx.restore();
}

/* 眼睛：平时黑色椭圆 + 高光（跟着鼠标挪一点）；眨眼时一道线；开心时 ^ ^ */
function drawEyes(pos, look, blinking, happy, rx, ry){
  for (const [x0, y0] of pos){
    const x = x0 + look[0], y = y0 + look[1];
    if (happy) line([[x - rx, y + 3], [x, y - ry * 0.55], [x + rx, y + 3]], INKC, 4);
    else if (blinking) line([[x - rx, y + 2], [x, y + 5], [x + rx, y + 2]], INKC, 4);
    else {
      ell(x, y, rx, ry); fs(INKC, 0);
      ell(x - rx * 0.3, y - ry * 0.4, rx * 0.32, ry * 0.22); fs('rgba(255,255,255,0.9)', 0);
    }
  }
}

/* 粉色杯子：圆角杯身 + 杯口 + 左边的把手；不喝的时候冒热气 */
function drawMug(x, y, tilt, steam, t){
  ctx.save();
  ctx.translate(x, y); ctx.rotate(tilt);
  ctx.beginPath(); ctx.ellipse(-26, 2, 11, 13, 0, -Math.PI / 2, Math.PI / 2, true);
  ctx.strokeStyle = INKC; ctx.lineWidth = 5 + LW * 2 * LINE_K; ctx.stroke();
  ctx.strokeStyle = COL.mugPink; ctx.lineWidth = 5; ctx.stroke();
  smooth([[-24, -22], [24, -22], [23, 20], [16, 25], [-16, 25], [-23, 20]]); fs(COL.mugPink);
  line([[-14, -10], [-15, 14]], 'rgba(255,255,255,0.7)', 4);
  ell(0, -22, 24, 6); fs(COL.mugPinkDk, 2.8);
  if (steam){
    for (let i = 0; i < 2; i++){
      const ph = (t * 0.45 + i * 0.5) % 1, a = Math.sin(ph * Math.PI) * 0.45;
      const sx = -8 + i * 14, sy = -32 - ph * 38;
      ctx.beginPath();
      for (let j = 0; j <= 6; j++){
        const yy = sy - j * 4, xx = sx + Math.sin(j * 0.9 + t * 3 + i) * 4;
        j ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
      }
      ctx.strokeStyle = `rgba(58,42,40,${a})`; ctx.lineWidth = 2.6 * LINE_K; ctx.stroke();
    }
  }
  ctx.restore();
}

/* ============================================================
   粉色兔耳小鸟：以身体中心为原点、面朝右（外面镜像）
   ============================================================ */
function drawBunny(t, flap){
  const ear = Math.sin(t * 2.4) * 0.08;
  ell(-22, -62, 9, 30, -0.3 + ear); fs(COL.bunnyEar); ell(-22, -60, 4, 20, -0.3 + ear); fs(COL.bunny, 0);
  ell(-2, -66, 9, 32, 0.08 - ear); fs(COL.bunnyEar); ell(-2, -64, 4, 21, 0.08 - ear); fs(COL.bunny, 0);
  fluffy(0, 0, 38, 34, 9, 0.07, 0.2); fs(COL.bunny);
  ell(34, 2, 15, 9, -0.5 + Math.sin(t * flap) * 0.35); fs(COL.bunnyDk);   // 扑腾的小翅膀
  ell(12, -8, 3.6, 4.6); fs(INKC, 0);
  smooth([[26, -2], [37, 1], [26, 5]]); fs(COL.beak, 2);
  line([[-8, 34], [-10, 44]], INKC, 3); line([[8, 34], [10, 44]], INKC, 3);
}

/* 飘起来的爱心（世界坐标） */
function drawHeartParticles(hearts){
  for (const p of hearts){
    const k = p.t / p.life, a = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.55) / 0.45);
    ctx.globalAlpha = Math.max(0, a);
    heartPath(p.x, p.y, p.size * (0.7 + 0.3 * Math.min(1, k * 4)));
    ctx.fillStyle = COL.heart; ctx.fill();
    ctx.strokeStyle = INKC; ctx.lineWidth = 1.6; ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
