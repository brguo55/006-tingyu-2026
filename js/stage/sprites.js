"use strict";
/* ============================================================
   sprites.js：像素角色 —— 粉发骑士（照着你画的那张像素图，26 × 52）、兔耳小鸟、爱心、羽毛
   ------------------------------------------------------------
   原图只有一帧（站姿），其余动作都是从它「改」出来的：
     呼吸：身体中间抽掉一行 → 头和肩膀往下沉 1 像素
     眨眼 / 开心（^ ^）：只改眼睛那几个像素
     走路：8 帧，两条腿重新画（大腿 + 小腿 + 靴子，膝盖往前弯），身体一起一伏、两手前后摆、长摆轻晃
           ——临时手调的，画师交稿后整套换掉
     起跳：膝盖收起（腿抽掉 4 行，整个人往上提）；下落：两腿微微分开；落地：蹲一下（抽掉 2 行）
     坐：上半身照旧，下半身换成画好的坐姿（大腿平放、小腿垂下）
   以后找画师画好真正的帧动画，只要换掉这里的帧就行（Room 只按名字取帧）
   ============================================================ */

/* 骑士的调色板（从原图里取的 15 个颜色） */
const KP = {
  k: '#090b0b', '1': '#595b5b', '2': '#787a79', '3': '#b7b9b8', w: '#f0f2f4',
  y: '#e0ed9c', g: '#b0c668', G: '#859645',
  h: '#fdacad', H: '#f5757b', m: '#b55187',
  s: '#fde8df', S: '#ed9b84', b: '#394c7d', B: '#223462',
};
const KNIGHT_BASE = [
  '...........kk.kk..........',  // 0
  '..........kHkkhkk.........',  // 1
  '.........kkkkHkHHmk.......',  // 2
  '........kHhHmhHhhhmk......',  // 3
  '.......kHhhhHhhhhhhHk.....',  // 4
  '......kkHhhhhhhhhhhsk.....',  // 5
  '......kmhshhhhhhhHsssk....',  // 6
  '......mHsshsmkshHHhsHk....',  // 7
  '......khshsHkSkshhmhhm....',  // 8
  '......khhHHkSsSkkmHHhk....',  // 9
  '.......kHkkSkksskkmhHk....',  // 10
  '......kmhHkkwmssmwkHk.....',  // 11
  '.......kHkSkwHssHwkk......',  // 12
  '.......kkmkSsssssSkmk.....',  // 13
  '........kkkkSsssSkkkk.....',  // 14
  '......kkkkkkkkkkkbk.......',  // 15
  '.....k332k3k21byygkk......',  // 16
  '....k3321211kkkbygkk......',  // 17
  '...kk221k11111kkggggk.....',  // 18
  '..kk1kkkk221kkkgyygygk....',  // 19
  '..kkkk1k2322kgyyyyyyyk....',  // 20
  '.kk2k32k13221kkyyygyyk....',  // 21
  '.kkk321k1132kggyygkyk.....',  // 22
  'kk2k21kkkk11kkkggkkgk.....',  // 23
  'k1kk1k.kk13221kgykgk......',  // 24
  'kk21k...kk1111kyykkgk.....',  // 25
  'k2321...k13221kykkyykk....',  // 26
  'k1322k..kBBbbbbbkkgygk....',  // 27
  '.k131k..kBBbbbbbBkkgbbkk..',  // 28
  '.k1kk1kkkk1kkkkkkkkbbkk1k.',  // 29
  '.kkk1kkk11k1kbggggkkkk1k2k',  // 30
  '..k1221k321kkbgggyykkkk21k',  // 31
  '..kk12kk3221kbgyyyygkk11k.',  // 32
  '...kkkk13222kbyyyyygk.kk..',  // 33
  '.....k132221kbyyyyyyk.....',  // 34
  '.....k13222kkBgyyyyygk....',  // 35
  '.....k32221kGkbyyyyygk....',  // 36
  '....kkk322kkGkbyyyyyyk....',  // 37
  '....kk1kk1kGGkbyyyyyykk...',  // 38
  '....k1321kkGGkbyyyyyygk...',  // 39
  '...kkk22kkkGGkbyyyyyygk...',  // 40
  '...k12kk1kkGGkbyyyyyygk...',  // 41
  '..k13k22k.kGGkbgyyyyybk...',  // 42
  '..k23k21k..kkkbgyyybBkk...',  // 43
  '..k3k21k.....kbggbbkkkk...',  // 44
  '..k3k11k.....kBbbkk1k1k...',  // 45
  '.kk1kkk.......kkk.k1kkk...',  // 46
  '.kkkkkk...........kkkkk...',  // 47
  'k13222k..........k12321k..',  // 48
  '1322221k.........k232221k.',  // 49
  'k11111kk.........k111111k.',  // 50
  'kkkkkkkk.........kkkkkkkk.',  // 51
];
/* 坐姿的下半身（第 29 行以下，宽 30）：大腿平放在椅面上、小腿垂下 */
const KNIGHT_SIT_LEGS = [
  '.k1kk.kkkkkkbyyyyyyyyygk......',  // 29
  '.kkk1k33333kbyyyyyyyyygk......',  // 30
  '..k12k22222kbgggggggyygk......',  // 31
  '..kk1k22222kkkkkkkkgyygk......',  // 32
  '...kkk11111111111kkgyygk......',  // 33
  '.....kkkkkkkkkkkkkkgyygk......',  // 34
  '..............k21kkbbbb.......',  // 35
  '..............k21kkkkkkk......',  // 36
  '..............k21k3221k.......',  // 37
  '..............k21k3221k.......',  // 38
  '..............k21k3221k.......',  // 39
  '..............k21k3221k.......',  // 40
  '..............k21k3221k.......',  // 41
  '..............k2kkkkkkkkk.....',  // 42
  '.............kkkk33333333k....',  // 43
  '.............k11k22222222k....',  // 44
  '.............k11k11111111k....',  // 45
  '.............kkkkkkkkkkkkk....',  // 46
];

/* ---------- 从原图推导出各个动作 ---------- */
const KPAD = 3, KW = 34;            // 左边留 3 像素、总宽 34（迈腿 / 坐下时不会被切掉）
const K_AX = 13 + KPAD;             // 脚底中点：原图第 13 列的左边
const kGrid = rows => rows.map(r => ('.'.repeat(KPAD) + r).padEnd(KW, '.').split(''));
const kBlank = h => Array.from({ length: h }, () => Array(KW).fill('.'));
/* 两条腿各占哪些像素（原图的列号，按行）：后腿斜着伸向左下，前腿只在长摆下面露出来 */
const BACK_LEG = { 33: [7, 12], 34: [5, 12], 35: [5, 11], 36: [5, 11], 37: [4, 11], 38: [4, 10], 39: [4, 10], 40: [3, 10], 41: [3, 10],
  42: [2, 8], 43: [2, 8], 44: [2, 7], 45: [2, 7], 46: [1, 6], 47: [1, 6], 48: [0, 7], 49: [0, 7], 50: [0, 7], 51: [0, 7] };
const FRONT_LEG = { 44: [19, 22], 45: [18, 22], 46: [18, 22], 47: [18, 22], 48: [17, 24], 49: [17, 24], 50: [17, 24], 51: [17, 24] };
function kLayer(g, mask){
  const out = kBlank(g.length);
  for (const [r, [a, b]] of Object.entries(mask)) for (let c = a + KPAD; c <= b + KPAD; c++){ out[r][c] = g[r][c]; g[r][c] = '.'; }
  return out;
}
function kOver(dst, src, dy = 0){
  src.forEach((row, r) => row.forEach((ch, c) => { if (ch !== '.' && dst[r + dy]) dst[r + dy][c] = ch; }));
}
/* 从第 r0 行往下，每行多错开一点，到最底下一共错开 amt 列 */
function kShear(layer, r0, amt, rows){
  const out = kBlank(layer.length);
  layer.forEach((row, r) => {
    const s = r < r0 ? 0 : Math.round((r - r0) / rows * amt);
    row.forEach((ch, c) => { if (ch !== '.' && c + s >= 0 && c + s < KW) out[r][c + s] = ch; });
  });
  return out;
}
function kWalk(g0, back, front, lift){
  const rest = g0.map(r => r.slice()), b = kLayer(rest, BACK_LEG), f = kLayer(rest, FRONT_LEG);
  const out = kBlank(g0.length);
  kOver(out, kShear(b, 33, back, 18));
  kOver(out, rest);
  kOver(out, kShear(f, 43, front, 8), -lift);
  return out;
}
/* 抽掉 [from, from + n) 这几行，上面的整体往下落 */
function kDropRows(g0, from, n){
  const keep = g0.filter((_, r) => r < from || r >= from + n);
  return kBlank(g0.length - keep.length).concat(keep.map(r => r.slice()));
}
function kEyes(g0, kind){
  const g = g0.map(r => r.slice()), P = c => c + KPAD;
  if (kind === 'open') return g;
  for (const c of [12, 13, 16, 17]){ g[10][P(c)] = 's'; g[11][P(c)] = 's'; }
  if (kind === 'blink') for (const c of [11, 12, 13, 16, 17, 18]) g[12][P(c)] = 'k';
  else {   // 开心：^ ^
    for (const c of [12, 13, 16, 17]) g[12][P(c)] = 's';
    for (const [r, c] of [[11, 12], [12, 11], [12, 13], [11, 17], [12, 16], [12, 18]]) g[r][P(c)] = 'k';
  }
  return g;
}
/* ---------- 走路（8 帧）----------
   经典走路循环：触地 → 下沉 → 交错（另一只脚抬起来）→ 上升 → 换另一只脚触地 …
   每帧给出两只脚相对各自髋部的位置（x 偏移、抬起多高），膝盖用两段 IK 算出来、往前弯；
   上半身、两只手、长摆从原图里切出来，按帧上下起伏 / 前后摆 */
const WALK_BOB = [0, 1, 0, -1, 0, 1, 0, -1];
const WALK_FRONT = [[6, 0], [4, 0], [0, 0], [-4, 0], [-7, 0], [-6, 0], [-1, 3], [4, 2]];   // 前腿（画面右边那条）
const WALK_BACK = [[-6, 0], [-5, 0], [0, 3], [6, 2], [10, 0], [7, 0], [2, 0], [-3, 0]];    // 后腿（被长摆挡住一半）
const BOOT_FRONT = ['.k1kkk...', 'k13222k..', 'k1322221k', 'k1111111k', 'kkkkkkkkk'];
const BOOT_BACK = ['.kkkkk...', 'k12111k..', 'k1211111k', 'k1111111k', 'kkkkkkkkk'];
const rHalfEven = v => { const f = Math.floor(v), d = v - f; return d > 0.5 ? f + 1 : d < 0.5 ? f : (f % 2 ? f + 1 : f); };
function kLeg(F, hx, hy, fx, fy, back){
  const L1 = 9.5, L2 = 9, R = 2.7;
  const d = Math.min(Math.hypot(fx - hx, fy - hy), L1 + L2 - 0.01), a = Math.atan2(fy - hy, fx - hx);
  const b = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const kx = hx + L1 * Math.cos(a - b), ky = hy + L1 * Math.sin(a - b);
  const fill = back ? '1' : '2', lt = back ? '2' : '3';
  const seg = (x0, y0, x1, y1) => {   // 粗线段：外圈黑边，靠前一侧亮、靠后一侧暗
    const vx = x1 - x0, vy = y1 - y0, L = Math.hypot(vx, vy) || 1, nx = -vy / L, ny = vx / L;
    for (let r = 0; r < F.length; r++) for (let c = 0; c < KW; c++){
      const px = c - KPAD, t = clamp(((px - x0) * vx + (r - y0) * vy) / (L * L), 0, 1);
      const cx = x0 + vx * t, cy = y0 + vy * t, dd = Math.hypot(px - cx, r - cy);
      if (dd > R + 0.9) continue;
      const side = (px - cx) * nx + (r - cy) * ny;
      F[r][c] = dd > R - 0.4 ? 'k' : side < -1 ? '1' : side > 0.9 ? lt : fill;
    }
  };
  seg(hx, hy, kx, ky); seg(kx, ky, fx, fy);
  const kr = rHalfEven(ky), kc = rHalfEven(kx) + KPAD;   // 膝盖上的护甲亮点
  if (F[kr]){ F[kr][kc] = back ? '2' : '3'; if (kc + 1 < KW) F[kr][kc + 1] = 'k'; }
  const boot = back ? BOOT_BACK : BOOT_FRONT, bx = rHalfEven(fx) - 3 + KPAD, by = rHalfEven(fy) - 1;
  boot.forEach((row, i) => [...row].forEach((ch, j) => { if (ch !== '.' && F[by + i] && bx + j < KW) F[by + i][bx + j] = ch; }));
}
function kWalkCycle(g0){
  const src = g0.map(r => r.slice(KPAD, KPAD + 26)), at = (r, c) => (src[r] && src[r][c]) || '.';
  const pick = (r0, r1, c0, c1, ok = () => true) => {
    const out = [];
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (at(r, c) !== '.' && ok(r, c)) out.push([r, c]);
    return out;
  };
  const key = ([r, c]) => r * 100 + c;
  const lhand = pick(24, 33, 0, 7, (r, c) => !(r < 29 && c > 6));
  const rhand = pick(28, 33, 21, 25);
  const hands = new Set([...lhand, ...rhand].map(key));
  const tab = pick(29, 46, 11, 21, (r, c) => !hands.has(r * 100 + c));
  const tabSet = new Set(tab.map(key));
  const body = pick(0, 28, 0, 25, (r, c) => !hands.has(r * 100 + c))
    .concat(pick(29, 33, 6, 12, (r, c) => !hands.has(r * 100 + c) && !tabSet.has(r * 100 + c)));
  return WALK_BOB.map((bob, i) => {
    const F = kBlank(52), [fbx, fby] = WALK_BACK[i], [ffx, ffy] = WALK_FRONT[i];
    kLeg(F, 8, 31 + bob, 8 + fbx, 47.5 - fby, true);
    kLeg(F, 16, 31 + bob, 16 + ffx, 47.5 - ffy, false);
    const put = (r, c, ch) => { if (F[r] && c >= 0 && c < KW) F[r][c] = ch; };
    const sway = [0, 0, -1, -1, 0, 0, -1, -1][i], swing = ffx >= 3 ? 1 : (ffx <= -3 ? -1 : 0);
    for (const [r, c] of body) put(r + bob, c + KPAD, at(r, c));
    for (const [r, c] of tab) put(r + bob, c + KPAD + (r >= 40 ? sway : 0), at(r, c));
    for (const [r, c] of lhand) put(r + bob, c + KPAD + (r >= 27 ? swing : 0), at(r, c));
    for (const [r, c] of rhand) put(r + bob, c + KPAD - (r >= 29 ? swing : 0), at(r, c));
    return F;
  });
}
function kSit(g0){
  return g0.slice(0, 29).map(r => r.slice()).concat(kGrid(KNIGHT_SIT_LEGS));
}

/* KF[眼睛][动作] = { r: 朝右的画布, l: 朝左的画布, h: 高 }；K_DY：画的时候整体往上挪几像素 */
const KF = {};
const K_DY = { jump: -4 };
for (const eye of ['open', 'blink', 'happy']){
  const g0 = kEyes(kGrid(KNIGHT_BASE), eye);
  const poses = {
    idle: g0,
    breathe: kDropRows(g0, 21, 1),
    jump: kDropRows(g0, 37, 4),
    fall: kWalk(g0, -2, 2, 0),
    land: kDropRows(g0, 37, 2),
    sit: kSit(g0),
  };
  kWalkCycle(g0).forEach((g, i) => { poses['walk' + i] = g; });
  KF[eye] = {};
  for (const [name, g] of Object.entries(poses)){
    const rows = g.map(r => r.join(''));
    KF[eye][name] = { r: makeSprite(rows, KP, false), l: makeSprite(rows, KP, true), h: rows.length };
  }
}

/* ---------- 兔耳小鸟（两帧：翅膀放下 / 扬起）---------- */
const BP = { k: '#3a2a2a', P: '#f4abb6', D: '#dd8997', E: '#fdf3f3', I: '#f9cdcf', O: '#f0b85a' };
const BUNNY_A = [
  '..kk..kk......',
  '.kEEk.kEEk....',
  '.kEIk.kIEk....',
  '.kEIk.kIEk....',
  '..kEkkkEk.....',
  '..kPPPPPPkk...',
  '.kPPPPPPPPPk..',
  'kPPPPPPPkPPPk.',
  'kPPPPPPPPPPOOk',
  'kPDDDPPPPPPkk.',
  'kPPDDDPPPPPk..',
  '.kPPPPPPPPk...',
  '..kkkkkkkk....',
];
const BUNNY_B = [
  '..kk..kk......',
  '.kEEk.kEEk....',
  '.kEIk.kIEk....',
  '.kEIk.kIEk....',
  '..kEkkkEk.....',
  '..kPPPPPPkk...',
  '.kPPPPPPPPPk..',
  'kkkkPPPPkPPPk.',
  'kDDDkPPPPPPOOk',
  '.kDDkPPPPPPkk.',
  '..kkPPPPPPPk..',
  '.kPPPPPPPPk...',
  '..kkkkkkkk....',
];
const BUNNY = [BUNNY_A, BUNNY_B].map(rows => ({ r: makeSprite(rows, BP, false), l: makeSprite(rows, BP, true) }));

/* ---------- 爱心 / 羽毛 ---------- */
const HEART = makeSprite([
  '.rr.rr.',
  'rhrrrrR',
  'rrrrrrR',
  '.rrrrR.',
  '..rRR..',
  '...R...',
], { r: '#e6646d', R: '#c24f5a', h: '#fbd0d3' });
const FEATHER_PAL = { k: '#8a6f73', w: '#fffdf8', p: '#f9cdcf' };
const FEATHERS = [
  ['.kkk.', 'kwwwk', '.kkk.'],
  ['..kk', '.kwk', 'kwk.', 'kk..'],
  ['.k.', 'kwk', 'kwk', 'kwk', '.k.'],
  ['kk..', 'kwk.', '.kwk', '..kk'],
].map(rows => ({ w: makeSprite(rows, FEATHER_PAL), p: makeSprite(rows.map(r => r.replace(/w/g, 'p')), FEATHER_PAL) }));
