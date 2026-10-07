"use strict";
/* ============================================================
   sprites.js：像素角色 —— rabbit（画师画的帧动画）、兔耳小鸟、爱心、羽毛
   ------------------------------------------------------------
   rabbit 坐在悬浮的金椅子上，每帧 52 × 60 像素，横着排成一条（assets/rabbit/*.png）
   锚点：椅子底的中点在第 AX 列、第 BOTTOM 行；画的时候椅子底离地 HOVER 像素（飘着）
   命名：状态_rabbit_序号_方向，比如 idle_rabbit_right、focus_rabbit_one_right
   rabbit 左右两边不对称（一边衣服、一边机械），不能镜像 —— 朝左的帧要画师另画
   ============================================================ */

const RABBIT = {
  W: 52, H: 60, AX: 21, BOTTOM: 56, HOVER: 6,
  anims: {
    idle:  { src: 'assets/rabbit/idle_rabbit_right.png',      n: 6,  fps: 10 },   // 闭眼静坐，轻轻起伏
    focus: { src: 'assets/rabbit/focus_rabbit_one_right.png', n: 11, fps: 10 },   // 番茄钟专注：喝茶、呼一口气
  },
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
