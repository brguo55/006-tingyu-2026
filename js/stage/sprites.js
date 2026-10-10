"use strict";
/* ============================================================
   sprites.js：像素角色 —— rabbit（老师画的帧动画）、兔耳小鸟、爱心
   ------------------------------------------------------------
   rabbit 的动画在 assets/rabbit/ 下，文件夹和文件名都照你整理的（00_basic、02_pomodoro……），
   原来的 GIF 转成同名的 PNG 帧条：每帧 80 × 112 像素，横着排成一条
   锚点：椅子底的中点在第 AX 列、第 BASE 行；画的时候椅子底离地 HOVER 像素（飘着）
   rabbit 左右两边不对称（一边衣服、一边机械），不能镜像，所以左右各一套
   ============================================================ */

const RABBIT = {
  W: 80, H: 112, BASE: 90, HOVER: 6,
  AX: { right: 39, left: 40 },
  anims: {
    idle_right: { src: 'assets/rabbit/00_basic/00_idle_rabbit_right.png', n: 6 },
    idle_left:  { src: 'assets/rabbit/00_basic/01_idle_rabbit_left.png', n: 6 },
    jump_right: { src: 'assets/rabbit/00_basic/02_jump_rabbit_right.png', n: 11 },
    jump_left:  { src: 'assets/rabbit/00_basic/03_jump_rabbit_left.png', n: 11 },
    sec_left:   { src: 'assets/rabbit/00_basic/04_jump_sec_rabbit_left.png', n: 17 },     // 二段跳（含起跳和落地）
    sec_right:  { src: 'assets/rabbit/00_basic/05_jump_sec_rabbit_right.png', n: 17 },
    focus_right: { src: 'assets/rabbit/02_pomodoro/00_focus_rabbit_one.png', n: 11 },   // 番茄钟专注（只有朝右）
  },
  /* 跳跃动画是「原地跳」：画里椅子自己会升高。每帧椅子比平时高了多少像素 ——
     在空中播的时候把这段减掉，跳多高由游戏的物理决定，动作和气环、喷火照样保留 */
  LIFT: {
    jump: [0, 2, 16, 19, 17, 7, 2, -3, -4, -3, -1],
    sec:  [0, 2, 16, 19, 17, 7, 10, 18, 31, 33, 29, 16, 2, -3, -4, -3, -1],
  },
  /* 每段要播的帧（帧号是帧条里的第几帧）和每帧的时长（毫秒，照原 GIF） */
  TAKEOFF: [1, 2, 3, 4],              // 起跳：脚下一圈气环
  BOOST:   [6, 7, 8, 9, 10, 11],      // 二段跳：椅子底下喷火再冲一截（用 sec 动画）
  RISE: 5, FALL: 6,                   // 在空中：往上时 / 往下掉时停在这两帧
  LAND:    [7, 8, 9, 10],             // 落地：往下一沉再回来（用 jump 动画）
  MS: { jump: [100, 100, 100, 100, 100, 100, 80, 80, 80, 80, 80], sec: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 80, 80, 80, 80, 80] },
};
for (const a of Object.values(RABBIT.anims)){ a.img = new Image(); a.img.src = a.src; }

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

/* ---------- 爱心 ---------- */
const HEART = makeSprite([
  '.rr.rr.',
  'rhrrrrR',
  'rrrrrrR',
  '.rrrrR.',
  '..rRR..',
  '...R...',
], { r: '#e6646d', R: '#c24f5a', h: '#fbd0d3' });
