"use strict";
/* ============================================================
   house.js：像素小房子（整张地图 1800 × 500 像素，1 像素 = 2 世界单位）
   ------------------------------------------------------------
   分层（从远到近）：
     窗外远景（雨天的天、远山、树，跟着镜头只移动一半）+ 雨丝
     房子（静态：墙、地板、家具 —— 预先画好一整张；窗户的玻璃是透明的，透出后面的远景）
     会动的小东西（电脑屏幕里在下雨、挂钟、台灯 / 灯笼的光、茶壶的热气、主机的灯）
     人物（room.js 画）
     前景（柱子、藤蔓、大盆栽：比中景移动得快 → 景深）
   坐标：这里全部是「像素」坐标；平台的 y（世界单位）÷ 2 就是那块板子的顶面那一行
   ============================================================ */

const AW = MAP_W / PX, AH = MAP_H / PX;                       // 1800 × 500
const A_FL = FLOOR_Y / PX, A_MZ = MEZZ_Y / PX, A_MX = MEZZ_X0 / PX;
const A_WL = WALL_L / PX, A_WR = WALL_R / PX, A_CE = CEIL_Y / PX;

/* ---------- 房子的调色板（暖、略灰，和骑士的颜色不打架） ---------- */
const HC = {
  out: '#2b2128',
  beam: '#5c3d2e', beamLt: '#7a5440', beamDk: '#3f2a21',
  wdk: '#6e4631', wd: '#8f5e3f', wm: '#b07a4e', wl: '#cc9b69', wh: '#e3bd8b',
  fl: '#b4825a', flLt: '#d8ab7b', flDk: '#9c6c47', flSeam: '#7b5238',
  brick: '#5e4538', brickLt: '#735545', brickDk: '#46332a',
  metal: '#434a59', metalLt: '#7a8396', screen: '#2c4757', pc: '#d9dde6', keys: '#e6e9ef', keysDk: '#a9b0bd',
  paper: '#f3e7c9', paperDk: '#d9c69c', cork: '#c9a27a', corkDk: '#b48b63',
  leaf: '#6f9567', leafLt: '#9cbf8e', leafDk: '#4c6c4a',
  pot: '#c98a62', potLt: '#dda47c', potDk: '#9c6545',
  pink: '#f2a2a9', pinkLt: '#f9cdcf', pinkDk: '#d98591',
  blue: '#7e9fb0', blueLt: '#a9c3cf', blueDk: '#5f7f91',
  gold: '#e2c27a', goldLt: '#f4e2a8', goldDk: '#b8964f',
  white: '#fbf6ea', red: '#c96f6a', redLt: '#e39a8f', cream: '#f7f1e3', purple: '#b48ab0', purpleDk: '#8f6a8c',
  box: '#d9b48a', boxLt: '#ead0ab', boxDk: '#b48a62', lantern: '#f0a75a', lanternLt: '#f8c98a', lanternDk: '#c9783c',
};
const BOOKC = [['#c96f6a', '#a65450'], ['#7e9fb0', '#5f7f91'], ['#d8b25c', '#b08c3e'], ['#8daa86', '#6c8a66'], ['#b48ab0', '#8f6a8c'], ['#e6d6b8', '#c4b291']];

/* 跟着主题变的颜色：墙纸、护墙板、地毯 */
function themeCols(){
  const T = THEMES[themeIdx], wall = lerpC(PAPER, T.W, 0.38), wsc = lerpC([190, 150, 112], T.W, 0.14);
  return {
    wall: rgbHex(wall), wallLt: rgbHex(lerpC(wall, [255, 255, 255], 0.3)), wallDk: rgbHex(lerpC(wall, [70, 50, 45], 0.14)),
    wsc: rgbHex(wsc), wscLt: rgbHex(lerpC(wsc, [255, 240, 220], 0.25)), wscDk: rgbHex(lerpC(wsc, [60, 40, 30], 0.2)),
    rug: rgbHex(T.W), rugLt: rgbHex(T.LT), rugDk: rgbHex(T.DK),
  };
}

/* ============================================================
   静态部分：整张地图画一次（换主题时重画）
   ============================================================ */
let houseCv = null, houseOld = null, houseTheme = -1;
function buildHouse(){
  if (houseCv && houseTheme !== themeIdx){ houseOld = houseCv; houseCv = null; }
  houseCv = houseCv || pxCanvas(AW, AH);
  paintHouse(houseCv.getContext('2d'));
  houseTheme = themeIdx;
}
function paintHouse(g){
  PG = g;
  g.clearRect(0, 0, AW, AH);
  const tc = themeCols();
  rect(0, 0, AW, AH, HC.out);
  // 室内的墙 + 墙纸（竖条纹 + 小菱形）
  rect(A_WL, A_CE, A_WR - A_WL, A_FL - A_CE, tc.wall);
  for (let x = A_WL + 14; x < A_WR; x += 30) rect(x, A_CE, 2, A_FL - A_CE, tc.wallLt);
  for (let x = A_WL + 29, i = 0; x < A_WR; x += 30, i++){
    for (let y = A_CE + 16 + (i % 2) * 14; y < A_FL - 32; y += 28){ dot(x, y - 1, tc.wallDk); rect(x - 1, y, 3, 1, tc.wallDk); dot(x, y + 1, tc.wallDk); }
  }
  rect(A_WL, A_CE, A_WR - A_WL, 1, tc.wallDk); dither(A_WL, A_CE + 1, A_WR - A_WL, 2, tc.wallDk);
  // 护墙板：一楼、阁楼
  wainscot(A_WL, A_FL - 30, A_WR - A_WL, 30, tc);
  wainscot(A_MX, A_MZ - 25, A_WR - A_MX, 25, tc);
  // 屋顶大梁
  rect(0, 0, AW, A_CE, HC.beam); rect(0, 0, AW, 2, HC.beamDk);
  for (let x = 24; x < AW; x += 48) rect(x, 3, 1, A_CE - 6, HC.beamDk);
  rect(0, A_CE - 2, AW, 1, HC.beamLt); rect(0, A_CE - 1, AW, 1, OUTL);
  // 竖梁（阁楼那边只到阁楼地板）
  for (const x of [280, 700, 1050, 1450]) post(x - 3, A_CE, (x >= A_MX ? A_MZ : A_FL) - A_CE);
  // 窗：玻璃是透明的
  windowHole(760, 320, 100, 100);
  windowHole(1525, 340, 100, 90);
  roundWindow(1350, 190, 26);
  // 地板
  rect(0, A_FL, AW, AH - A_FL, HC.fl);
  rect(0, A_FL, AW, 1, HC.flLt);
  rect(0, A_FL + 10, AW, 1, HC.flSeam); rect(0, A_FL + 20, AW, 1, HC.flSeam);
  for (let x = 6; x < AW; x += 37){ rect(x, A_FL + 1, 1, 9, HC.flSeam); rect(x + 18, A_FL + 11, 1, 9, HC.flSeam); rect(x + 9, A_FL + 21, 1, 9, HC.flSeam); }
  rect(0, A_FL + 21, AW, AH - A_FL - 21, HC.flDk); for (let x = 15; x < AW; x += 37) rect(x, A_FL + 21, 1, 9, HC.flSeam);
  // 两头的砖墙
  bricks(0, A_CE, A_WL, A_FL - A_CE); bricks(A_WR, A_CE, AW - A_WR, A_FL - A_CE);
  rect(A_WL - 1, A_CE, 1, A_FL - A_CE, OUTL); rect(A_WR, A_CE, 1, A_FL - A_CE, OUTL);

  drawEntrance();
  drawLibrary();
  drawTeaCorner(tc);
  drawStudy();
  drawRightEnd();
  drawMezzanine();
}

function wainscot(x, y, w, h, tc){
  rect(x, y, w, h, tc.wsc);
  rect(x, y, w, 1, OUTL); rect(x, y + 1, w, 2, tc.wscLt); rect(x, y + 3, w, 1, tc.wscDk);
  for (let px = x + 20; px < x + w - 4; px += 40){ rect(px, y + 6, 1, h - 10, tc.wscDk); rect(px + 1, y + 6, 1, h - 10, tc.wscLt); }
  rect(x, y + h - 4, w, 4, tc.wscDk); rect(x, y + h - 4, w, 1, OUTL);
}
function post(x, y, h){
  rect(x, y, 7, h, HC.wd); rect(x, y, 1, h, OUTL); rect(x + 6, y, 1, h, OUTL);
  rect(x + 1, y, 1, h, HC.wl); rect(x + 5, y, 1, h, HC.wdk);
}
function bricks(x, y, w, h){
  rect(x, y, w, h, HC.brick);
  for (let j = 0, r = 0; j < h; j += 6, r++){
    rect(x, y + j, w, 1, HC.brickDk); rect(x, y + j + 1, w, 1, HC.brickLt);
    for (let i = (r % 2) * 5 + 2; i < w; i += 10) rect(x + i, y + j + 1, 1, 5, HC.brickDk);
  }
}
function windowHole(x, y, w, h){
  bevel(x - 5, y - 5, w + 10, h + 10, HC.wm, HC.wl, HC.wd);
  rect(x - 1, y - 1, w + 2, h + 2, OUTL);
  PG.clearRect(x, y, w, h);
  const mx = x + (w >> 1) - 1, my = y + (h >> 1) - 1;
  rect(mx - 1, y, 4, h, OUTL); rect(mx, y, 2, h, HC.wm);
  rect(x, my - 1, w, 4, OUTL); rect(x, my, w, 2, HC.wm); rect(mx, my, 2, 2, HC.wl);
  // 玻璃上的反光（半透明）
  PG.fillStyle = 'rgba(255,255,255,0.28)';
  for (const [gx, gy, n] of [[x + 6, y + 22, 14], [x + 12, y + 24, 7], [mx + 8, y + 20, 10]]) for (let i = 0; i < n; i++) PG.fillRect(gx + i, gy - i, 1, 1);
  // 窗台（能站：顶面正好是 y + h）
  bevel(x - 6, y + h, w + 12, 5, HC.wl, HC.wh, HC.wd);
  rect(x - 3, y + h + 5, w + 6, 2, OUTL); rect(x - 2, y + h + 5, w + 4, 1, HC.wd);
}
function roundWindow(cx, cy, r){
  disc(cx, cy, r + 5, OUTL); disc(cx, cy, r + 4, HC.wm);
  for (let a = 3.5; a < 4.9; a += 0.05) dot(cx + Math.round(Math.cos(a) * (r + 3)), cy + Math.round(Math.sin(a) * (r + 3)), HC.wl);
  disc(cx, cy, r + 1, OUTL);
  for (let dy = -r; dy <= r; dy++){ const dx = Math.round(Math.sqrt(r * r - dy * dy)); PG.clearRect(cx - dx, cy + dy, dx * 2 + 1, 1); }
  rect(cx - 2, cy - r, 4, r * 2 + 1, OUTL); rect(cx - 1, cy - r, 2, r * 2 + 1, HC.wm);
  rect(cx - r, cy - 2, r * 2 + 1, 4, OUTL); rect(cx - r, cy - 1, r * 2 + 1, 2, HC.wm);
  PG.fillStyle = 'rgba(255,255,255,0.28)';
  for (let i = 0; i < 9; i++) PG.fillRect(cx - 16 + i, cy - 6 - i, 1, 1);
}

/* ---------- 小物件（字符画） ---------- */
const PW = { k: OUTL, d: HC.wd, m: HC.wm, l: HC.wl, D: HC.wdk };
const BRACKET = ['kmmmk', 'kmmk.', 'kmk..', 'kk...'];
const CACTUS = [
  '....k....',
  '...kgk...',
  '...kgk.k.',
  '.k.kgkkgk',
  'kgkkgkkgk',
  'kgkkgkgk.',
  '.kgkgkk..',
  '..kkgk...',
  '...kgk...',
  '.kkkkkkk.',
  '.kpPPPpk.',
  '..kpppk..',
  '..kkkkk..',
];
const CACTUS_PAL = { k: OUTL, g: HC.leaf, p: HC.pot, P: HC.potLt };
const BELL = [
  '....k....',
  '...kyk...',
  '..kyyyk..',
  '..kyYyk..',
  '.kyyYyyk.',
  '.kyyyyyk.',
  'kyyyyyyyk',
  'kkkkkkkkk',
  '...kyk...',
  '....k....',
];
const BELL_PAL = { k: OUTL, y: HC.gold, Y: HC.goldLt };
const TEAPOT = [
  '....kkk.....',
  '...kwwwk....',
  '.kkkkkkkk...',
  'kwwwwwwwwk.k',
  'kwwpwwwwwkkk',
  'kwpppwwwwkk.',
  'kwwpwwwwwk..',
  '.kwwwwwwk...',
  '..kkkkkk....',
];
const TEAPOT_PAL = { k: OUTL, w: HC.white, p: HC.pinkDk };
const CAPE = [
  '...kkk....',
  '..kpppk...',
  '..kppppk..',
  '.kppppPk..',
  '.kpppPppk.',
  '.kpppPppk.',
  'kppppPpppk',
  'kpppPppppk',
  'kpppPppppk',
  'kppPpppppk',
  'kppPppppPk',
  'kppPppppPk',
  'kpPpppppPk',
  'kpPpppppPk',
  '.kkkkkkkk.',
];
const CAPE_PAL = { k: OUTL, p: HC.pinkLt, P: HC.pink };
const HAT = ['..kkkk..', '.kbbbbk.', 'kbBbbbbk', 'kkkkkkkk'];
const HAT_PAL = { k: OUTL, b: HC.blue, B: HC.blueLt };
const BOOT = ['kkkk...', 'k12k...', 'k122kk.', 'k11111k', 'kkkkkkk'];
const BOOT_PAL = { k: '#2a2a2a', '1': '#595b5b', '2': '#787a79' };
const BUNNY_PIC = [
  '..k...k...',
  '.kek.kek..',
  '.kek.kek..',
  '..kpppk...',
  '.kppppkk..',
  'kppppppkk.',
  'kppkpppppk',
  'kpppppppk.',
  '.kkkkkkk..',
];
const BUNNY_PIC_PAL = { k: OUTL, e: HC.cream, p: HC.pink };
const LEAF = ['..kk.', '.kgLk', 'kggLk', 'kgLk.', 'kLk..', 'kk...'];
const LEAF_PAL = { k: OUTL, g: HC.leaf, L: HC.leafLt };

/* ---------- 门厅：门、伞桶（粉色雨伞）、衣帽架、鞋凳 ---------- */
function drawEntrance(){
  bevel(46, 391, 53, 79, HC.wm, HC.wl, HC.wd);
  boxO(51, 396, 43, 74, HC.wd);
  for (const [px, py, ph] of [[55, 401, 26], [73, 401, 26], [55, 432, 32], [73, 432, 32]]){
    rect(px, py, 17, ph, HC.wdk); rect(px + 1, py + ph - 1, 16, 1, HC.wm); rect(px + 16, py + 1, 1, ph - 1, HC.wm);
  }
  rect(88, 433, 4, 4, OUTL); rect(89, 434, 2, 2, HC.gold); dot(89, 434, HC.goldLt);
  rect(40, 467, 66, 3, OUTL); rect(41, 468, 64, 2, HC.red); for (let x = 43; x < 104; x += 4) dot(x, 468, HC.redLt);
  // 伞桶 + 收起来的粉伞
  rect(114, 430, 1, 24, OUTL); dot(113, 429, OUTL); dot(112, 429, OUTL); dot(111, 430, OUTL); dot(111, 431, OUTL);
  for (let y = 436; y < 454; y++){ const w = y < 440 ? 1 : (y < 448 ? 2 : 1); rect(114 - w - 1, y, w * 2 + 3, 1, OUTL); rect(114 - w, y, w * 2 + 1, 1, y % 5 ? HC.pink : HC.pinkDk); }
  bevel(108, 452, 13, 18, HC.blue, HC.blueLt, HC.blueDk); rect(109, 458, 11, 1, HC.blueLt);
  // 衣帽架：粉斗篷、蓝帽子
  rect(134, 400, 4, 68, OUTL); rect(135, 401, 2, 66, HC.wd); rect(135, 401, 1, 66, HC.wm);
  rect(126, 466, 20, 4, OUTL); rect(127, 467, 18, 2, HC.wd);
  rect(133, 397, 6, 4, OUTL); rect(134, 398, 4, 2, HC.wl);
  rect(128, 405, 7, 1, OUTL); rect(137, 405, 7, 1, OUTL);
  art(CAPE, CAPE_PAL, 122, 405);
  art(HAT, HAT_PAL, 139, 404);
  // 鞋凳（能站）+ 两只靴子
  bevel(165, 456, 51, 4, HC.wl, HC.wh, HC.wd);
  for (const x of [168, 209]) boxO(x, 460, 4, 10, HC.wd);
  art(BOOT, BOOT_PAL, 176, 465); art(BOOT, BOOT_PAL, 188, 465);
}

/* ---------- 书房：两个高书架、小凳、一路往上的置物板、墙上的地图 ---------- */
function books(x, y, w, h, seed){
  let cx = x + 1;
  for (let i = 0; ; i++){
    if ((i + seed) % 7 === 4) cx += 3;                         // 空一格
    const bw = 3 + ((i * 7 + seed * 3) % 3), bh = h - 6 + ((i * 5 + seed * 2) % 6);
    if (cx + bw + 1 > x + w) break;
    const [c, cd] = BOOKC[(i + seed * 2) % BOOKC.length];
    rect(cx, y + h - bh, bw + 2, bh, OUTL);
    rect(cx + 1, y + h - bh + 1, bw, bh - 1, c);
    rect(cx + 1, y + h - bh + 3, bw, 1, cd); rect(cx + 1, y + h - 4, bw, 1, cd);
    cx += bw + 1;
  }
}
function bookshelf(x0, x1, top){
  const bx = x0 + 2, bw = x1 - x0 - 4, by = top + 4, bh = A_FL - by;
  boxO(bx, by, bw, bh, HC.wm);
  rect(bx + 1, by, 1, bh - 1, HC.wl); rect(bx + bw - 2, by, 1, bh - 1, HC.wd);
  rect(bx + 3, by + 3, bw - 6, bh - 6, OUTL); rect(bx + 4, by + 3, bw - 8, bh - 6, HC.wdk);
  for (let y = by + 3, row = 0; y + 26 <= A_FL - 3; y += 26, row++){
    books(bx + 4, y, bw - 8, 22, row + x0);
    bevel(bx + 3, y + 22, bw - 6, 4, HC.wl, HC.wh, HC.wd);
  }
  bevel(x0, top, x1 - x0, 4, HC.wl, HC.wh, HC.wd);
}
function wallShelf(x0, x1, y, item){
  bevel(x0, y, x1 - x0, 4, HC.wl, HC.wh, HC.wd);
  art(BRACKET, PW, x0 + 3, y + 4); art(BRACKET.map(r => [...r].reverse().join('')), PW, x1 - 8, y + 4);
  if (item === 'books'){
    boxO(x1 - 15, y - 12, 5, 12, HC.blue); rect(x1 - 14, y - 9, 3, 1, HC.blueDk);
    boxO(x1 - 11, y - 10, 5, 10, HC.gold); rect(x1 - 10, y - 7, 3, 1, HC.goldDk);
    boxO(x0 + 4, y - 4, 13, 4, HC.red); rect(x0 + 5, y - 3, 11, 1, HC.redLt);
  } else if (item === 'cactus') art(CACTUS, CACTUS_PAL, x1 - 13, y - 13);
  else if (item === 'bell') art(BELL, BELL_PAL, x1 - 16, y - 10);
}
function drawLibrary(){
  bookshelf(318, 382, 350);
  bookshelf(488, 552, 325);
  bevel(430, 450, 26, 4, HC.wl, HC.wh, HC.wd);                 // 小凳
  for (const x of [433, 449]) boxO(x, 454, 4, 16, HC.wd);
  boxO(436, 461, 14, 3, HC.wd);
  wallShelf(395, 430, 410, 'books');
  wallShelf(435, 475, 370, 'cactus');
  wallShelf(560, 600, 285, 'books');
  wallShelf(610, 650, 240, 'cactus');
  wallShelf(650, 690, 200, 'bell');                             // 最高处的小铃铛
  // 墙上的手绘地图
  const x = 590, y = 350, w = 65, h = 45;
  boxO(x, y, w, h, HC.paper); rect(x + 1, y + h - 2, w - 2, 1, HC.paperDk); rect(x + w - 2, y + 1, 1, h - 2, HC.paperDk);
  dot(x + 3, y + 3, HC.red); dot(x + w - 4, y + 3, HC.red);
  for (const [mx, my] of [[x + 10, y + 16], [x + 18, y + 13], [x + 50, y + 34]]) for (let i = 0; i < 4; i++) rect(mx - i, my + i, i * 2 + 1, 1, HC.paperDk);
  disc(x + 42, y + 18, 5, HC.blueLt); disc(x + 44, y + 19, 3, HC.blue);
  for (let i = 0; i < 26; i += 3) dot(x + 12 + i, y + 32 - Math.round(Math.sin(i * 0.3) * 4), HC.leafDk);
  for (const [a, b] of [[0, 0], [1, 1], [2, 2], [2, 0], [0, 2]]) dot(x + 52 + a, y + 8 + b, HC.red);
}

/* ---------- 茶室：窗、木椅（粉坐垫）、茶几、地毯、兔子小画、通往阁楼的置物板 ---------- */
/* 木椅：椅面顶 = 458（CHAIR_SEAT），椅背在 900–906，椅面到骑士的膝盖为止（小腿垂在椅子前面）；
   扶手单独做成一张小图，坐着时盖在骑士前面 */
function chairBack(){
  boxO(900, 422, 7, 48, HC.wm); rect(901, 423, 1, 46, HC.wl); rect(905, 423, 1, 46, HC.wd);
  disc(903, 420, 3, OUTL); disc(903, 420, 2, HC.wm); dot(902, 419, HC.wl);
  rect(902, 457, 22, 4, OUTL); rect(903, 458, 20, 2, HC.pinkLt); rect(903, 460, 20, 1, HC.pink);
  bevel(900, 461, 25, 4, HC.wm, HC.wl, HC.wd);
  boxO(919, 465, 4, 5, HC.wd);
}
function chairFront(){
  bevel(900, 449, 26, 4, HC.wl, HC.wh, HC.wd);
  boxO(920, 453, 4, 5, HC.wd);
}
const CHAIR_FRONT = (() => {   // 坐着的时候盖在骑士前面的那部分（扶手 + 前腿）
  const c = pxCanvas(48, 30), g = c.getContext('2d'), keep = PG;
  PG = g; g.translate(-896, -444); chairFront(); g.setTransform(1, 0, 0, 1, 0, 0); PG = keep;
  return { c, x: 896, y: 444 };
})();
function drawTeaCorner(tc){
  // 地毯（主题色）
  rect(892, 467, 144, 3, OUTL); rect(893, 467, 142, 2, tc.rug); dither(893, 468, 142, 1, tc.rugDk);
  for (let x = 896; x < 1033; x += 6) dot(x, 467, tc.rugLt);
  for (const x of [889, 1037]) for (let y = 467; y < 470; y += 2) rect(x, y, 3, 1, tc.rugDk);
  // 墙上的兔子小画
  bevel(885, 360, 20, 24, HC.wm, HC.wl, HC.wd); rect(887, 362, 16, 20, HC.cream); art(BUNNY_PIC, BUNNY_PIC_PAL, 890, 368);
  chairBack(); chairFront();
  // 茶几 + 茶壶 + 两个杯子
  bevel(959, 455, 53, 4, HC.wl, HC.wh, HC.wd);
  boxO(961, 459, 49, 3, HC.wd);
  for (const x of [964, 1003]) boxO(x, 461, 4, 9, HC.wd);
  art(TEAPOT, TEAPOT_PAL, 978, 446);
  boxO(966, 450, 5, 5, HC.pink); dot(971, 452, OUTL);
  boxO(997, 450, 5, 5, HC.white); dot(1002, 452, OUTL);
  // 通往阁楼的一排置物板
  wallShelf(1060, 1100, 430, 'books');
  wallShelf(1115, 1155, 390);
  wallShelf(1060, 1100, 350, 'cactus');
  wallShelf(1115, 1155, 310);
}

/* ---------- 工作间：软木板、挂钟、转椅、书桌、电脑、台灯、矮书柜 ---------- */
function drawStudy(){
  // 软木板 + 便签
  bevel(1185, 340, 50, 38, HC.wm, HC.wl, HC.wd);
  rect(1188, 343, 44, 32, HC.cork); dither(1188, 343, 44, 32, HC.corkDk);
  for (const [x, y, c] of [[1192, 347, '#f7e98e'], [1207, 352, HC.pinkLt], [1220, 346, HC.blueLt], [1197, 361, '#d6e9c9']]){
    boxO(x, y, 11, 10, c); rect(x + 2, y + 4, 7, 1, '#b8ab8a'); rect(x + 2, y + 6, 5, 1, '#b8ab8a'); dot(x + 5, y + 1, HC.red);
  }
  // 挂钟（指针在 drawHouseLive 里按真实时间画）
  disc(1305, 330, 11, OUTL); disc(1305, 330, 10, HC.wm); disc(1305, 330, 8, HC.white);
  for (const [dx, dy] of [[0, -7], [7, 0], [0, 7], [-7, 0]]) dot(1305 + dx, 330 + dy, OUTL);
  // 转椅（能站：顶面 452）
  boxO(1199, 428, 5, 26, HC.blue); rect(1200, 429, 1, 24, HC.blueLt);
  bevel(1199, 452, 29, 4, HC.blue, HC.blueLt, HC.blueDk);
  rect(1212, 456, 3, 9, OUTL); rect(1213, 456, 1, 9, HC.metalLt);
  rect(1203, 464, 21, 3, OUTL); rect(1204, 465, 19, 1, HC.metalLt);
  for (const x of [1203, 1221]) { rect(x, 467, 3, 3, OUTL); dot(x + 1, 468, HC.metalLt); }
  // 书桌（能站：顶面 435）+ 抽屉
  bevel(1237, 435, 117, 5, HC.wl, HC.wh, HC.wd);
  boxO(1240, 440, 5, 30, HC.wd); boxO(1347, 440, 5, 30, HC.wd);
  bevel(1292, 440, 55, 13, HC.wm, HC.wl, HC.wd); rect(1315, 445, 9, 3, OUTL); rect(1316, 446, 7, 1, HC.gold);
  // 主机（桌下）
  bevel(1249, 441, 14, 29, HC.pc, '#f2f4f8', '#aab1c0');
  for (let y = 452; y < 466; y += 3) rect(1252, y, 8, 1, '#aab1c0');
  // 显示器（屏幕里的雨在 drawHouseLive 里画）+ 键盘、鼠标、杯子、台灯
  boxO(1254, 394, 37, 28, HC.metal); rect(1255, 395, 35, 1, HC.metalLt);
  rect(1257, 397, 31, 22, HC.screen);
  boxO(1270, 422, 5, 10, HC.metalLt); boxO(1264, 431, 17, 4, HC.metalLt);
  boxO(1294, 431, 22, 4, HC.keys); for (let x = 1296; x < 1314; x += 2) dot(x, 432, HC.keysDk);
  boxO(1319, 432, 5, 3, HC.keys);
  boxO(1328, 428, 6, 7, HC.pink); rect(1334, 430, 2, 1, OUTL); rect(1335, 431, 1, 2, OUTL); rect(1334, 433, 2, 1, OUTL);
  boxO(1338, 431, 11, 4, HC.gold); rect(1342, 417, 2, 14, OUTL);
  for (let j = 0; j < 8; j++){ const w = 4 + j; rect(1343 - w, 410 + j, w * 2 + 1, 1, OUTL); if (j < 7) rect(1344 - w, 410 + j, w * 2 - 1, 1, j < 2 ? HC.goldLt : HC.gold); }
  // 矮书柜（能站：顶面 430）
  bevel(1376, 430, 58, 4, HC.wl, HC.wh, HC.wd);
  boxO(1378, 434, 54, 36, HC.wm);
  rect(1381, 437, 48, 14, HC.wdk); books(1381, 437, 48, 14, 3);
  bevel(1379, 451, 52, 3, HC.wl, HC.wh, HC.wd);
  rect(1381, 454, 48, 13, HC.wdk); books(1381, 454, 48, 13, 5);
}

/* ---------- 右边：大窗旁的落地灯、坐垫、大盆栽 ---------- */
function drawRightEnd(){
  boxO(1701, 466, 19, 4, HC.metal);
  rect(1709, 412, 3, 54, OUTL); rect(1710, 412, 1, 54, HC.metalLt);
  for (let j = 0; j < 15; j++){ const w = 6 + Math.floor(j / 2); rect(1710 - w, 397 + j, w * 2 + 1, 1, OUTL); if (j && j < 14) rect(1711 - w, 397 + j, w * 2 - 1, 1, j < 3 ? HC.cream : (j > 11 ? HC.goldLt : '#f3e3b8')); }
  for (const [x, y, w, h, c, cd] of [[1632, 461, 27, 9, HC.pinkLt, HC.pink], [1656, 462, 23, 8, HC.blueLt, HC.blue]]){
    rect(x + 1, y, w - 2, h, OUTL); rect(x, y + 1, w, h - 2, OUTL); rect(x + 1, y + 1, w - 2, h - 2, c); rect(x + 2, y + h - 3, w - 4, 1, cd);
  }
  // 大盆栽
  for (const [lx, ly, fl] of [[1739, 420, 0], [1746, 412, 0], [1751, 424, 1], [1735, 432, 0], [1755, 436, 1], [1744, 428, 1]]){
    art(fl ? LEAF.map(r => [...r].reverse().join('')) : LEAF, LEAF_PAL, lx, ly);
    rect(lx + (fl ? 1 : 3), ly + 6, 1, 452 - ly - 6, HC.leafDk);
  }
  for (let j = 0; j < 18; j++){ const w = 12 - Math.floor(j / 4); rect(1748 - w, 452 + j, w * 2 + 1, 1, OUTL); if (j && j < 17) rect(1749 - w, 452 + j, w * 2 - 1, 1, j < 3 ? HC.potLt : HC.pot); }
}

/* ---------- 阁楼：木地板（能站）、栏杆、床、纸箱、灯笼、一摞书、小地毯 ---------- */
function drawMezzanine(){
  bevel(A_MX, A_MZ, A_WR - A_MX, 8, HC.wm, HC.wl, HC.wd);
  for (let x = A_MX + 20; x < A_WR; x += 40) rect(x, A_MZ + 2, 1, 4, HC.wd);
  for (let x = A_MX + 30; x < A_WR - 10; x += 60) art(['kmmmmk', 'kmmmk.', 'kmmk..', 'kmk...', 'kk....'], PW, x, A_MZ + 8);
  // 栏杆
  bevel(A_MX, A_MZ - 23, 34, 3, HC.wd, HC.wl, HC.wdk);
  for (let x = A_MX + 2; x < A_MX + 32; x += 7) boxO(x, A_MZ - 20, 3, 20, HC.wd);
  // 床（能站：顶面 260）
  bevel(1572, 228, 8, 52, HC.wm, HC.wl, HC.wd); disc(1575, 227, 2, OUTL); dot(1575, 227, HC.wl);
  bevel(1575, 266, 108, 7, HC.wm, HC.wl, HC.wd);
  for (const x of [1578, 1676]) boxO(x, 273, 5, 7, HC.wd);
  boxO(1579, 261, 103, 6, HC.white);
  boxO(1581, 255, 17, 7, HC.white); rect(1583, 260, 13, 1, HC.paperDk);
  rect(1598, 260, 85, 9, OUTL); rect(1599, 261, 83, 7, HC.pinkLt); rect(1599, 266, 83, 1, HC.pink);
  for (let x = 1608; x < 1680; x += 12) rect(x, 262, 1, 4, HC.pink);
  rect(1682, 261, 2, 12, OUTL); rect(1682, 261, 1, 11, HC.pinkLt);
  // 纸箱（能站：顶面 260 / 240）
  bevel(1200, 260, 31, 20, HC.box, HC.boxLt, HC.boxDk); rect(1201, 266, 29, 1, HC.boxDk); rect(1214, 261, 4, 5, HC.boxLt);
  bevel(1230, 240, 27, 40, HC.box, HC.boxLt, HC.boxDk); rect(1231, 247, 25, 1, HC.boxDk);
  boxO(1236, 255, 14, 8, HC.white); rect(1238, 257, 10, 1, HC.keysDk); rect(1238, 259, 7, 1, HC.keysDk);
  // 灯笼（光在 drawHouseLive 里）
  rect(1415, A_CE, 1, 140, OUTL);
  boxO(1411, 149, 9, 3, HC.wdk);
  for (let j = 0; j < 18; j++){ const w = Math.round(7 * Math.sin((j + 0.5) / 18 * Math.PI)) + 1; rect(1415 - w, 152 + j, w * 2 + 1, 1, OUTL); rect(1416 - w, 152 + j, w * 2 - 1, 1, j % 4 === 0 ? HC.lanternDk : (j < 5 ? HC.lanternLt : HC.lantern)); }
  boxO(1411, 170, 9, 3, HC.wdk); rect(1415, 173, 1, 6, HC.red); dot(1414, 179, HC.red); dot(1416, 179, HC.red);
  // 一摞书 + 小地毯
  for (const [x, y, w, c] of [[1488, 274, 20, BOOKC[1]], [1490, 270, 16, BOOKC[2]], [1487, 266, 19, BOOKC[0]]]){ boxO(x, y, w, 5, c[0]); rect(x + 1, y + 3, w - 2, 1, c[1]); }
  rect(1308, 278, 104, 2, OUTL); rect(1309, 278, 102, 1, HC.purple); for (let x = 1312; x < 1410; x += 5) dot(x, 278, HC.purpleDk);
}

/* ============================================================
   窗外远景：下着雨的天、远山、树（一张宽图，跟着镜头只移动一半）
   ============================================================ */
const FAR_W = 1200, FAR_H = 340;
const farCv = (() => {
  const c = pxCanvas(FAR_W, FAR_H), keep = PG;
  PG = c.getContext('2d');
  const sky = ['#8496aa', '#90a2b4', '#9cadbd', '#a8b8c6', '#b4c2cd', '#bfccd5', '#c9d4db'];
  sky.forEach((col, i) => { rect(0, i * 32, FAR_W, 32, col); if (i) dither(0, i * 32 - 2, FAR_W, 4, sky[i - 1], i); });
  rect(0, sky.length * 32, FAR_W, FAR_H, sky[sky.length - 1]);
  // 低低的雨云
  for (let i = 0; i < 26; i++){
    const x = (i * 97) % FAR_W, y = 40 + ((i * 53) % 90), r = 7 + (i * 7) % 9;
    disc(x, y, r, i % 3 ? '#9aaaba' : '#8b9cae'); disc(x + r, y + 2, r - 2, '#a6b5c3'); disc(x - r, y + 3, r - 3, '#a6b5c3');
  }
  // 远山 / 近一点的山 / 树 / 草地（越近越深）
  for (let x = 0; x < FAR_W; x++){
    const h1 = Math.round(176 + 16 * Math.sin(x * 0.011) + 8 * Math.sin(x * 0.033 + 1) + 3 * Math.sin(x * 0.09));
    rect(x, h1, 1, FAR_H - h1, '#93a8b2');
    const h2 = Math.round(206 + 10 * Math.sin(x * 0.017 + 2) + 5 * Math.sin(x * 0.051));
    rect(x, h2, 1, FAR_H - h2, '#7c968f');
  }
  for (let x = 0; x < FAR_W; x += 7 + Math.floor(hash(x) * 7)) disc(x, 232 + Math.floor(hash(x * 7) * 8), 5 + Math.floor(hash(x * 3) * 5), '#62807a');
  rect(0, 238, FAR_W, FAR_H - 238, '#62807a');
  for (let x = 0; x < FAR_W; x += 13) disc(x + 6, 254, 3, '#6d8c74');
  rect(0, 256, FAR_W, FAR_H - 256, '#6d8c74');
  for (let x = 0; x < FAR_W; x += 23) for (let i = 0; i < 3; i++) dot(x + i * 7 + (i & 1) * 3, 262 + i * 5, '#7f9c82');
  PG = keep;
  return c;
})();
/* 雨丝：在远景层上，所以只在窗户里看得见 */
const RAIN = Array.from({ length: 170 }, (_, i) => ({ x: hash(i * 3.1) * 460, y: hash(i * 7.7) * 270, v: 150 + hash(i * 1.3) * 70 }));

/* 灯光：抖动的半透明光圈（预先画好） */
function makeGlow(r, col){
  const c = pxCanvas(r * 2 + 1, r * 2 + 1), keep = PG;
  PG = c.getContext('2d');
  disc(r, r, Math.round(r * 0.55), col);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++){
    const d = dx * dx + dy * dy;
    if (d > r * r * 0.3 && d <= r * r && ((dx + dy) & 1) === 0) dot(r + dx, r + dy, col);
  }
  PG = keep;
  return c;
}
const GLOW_S = makeGlow(16, 'rgba(255,226,150,0.28)'), GLOW_L = makeGlow(30, 'rgba(255,214,140,0.22)');

/* ============================================================
   每帧：远景 + 房子（换主题时一格一格溶解过去）+ 会动的小东西
   g 是低分辨率画布；ix / iy 是镜头左上角（整数像素）
   ============================================================ */
let mixCv = null;
function drawHouseLayer(g, ix, iy, w, h){
  if (!houseCv || houseTheme !== themeIdx) buildHouse();
  if (houseOld && washT < 1){
    g.drawImage(houseOld, ix, iy, w, h, 0, 0, w, h);
    if (!mixCv || mixCv.width !== w || mixCv.height !== h) mixCv = pxCanvas(w, h);
    const m = mixCv.getContext('2d');
    m.globalCompositeOperation = 'source-over'; m.clearRect(0, 0, w, h);
    m.drawImage(houseCv, ix, iy, w, h, 0, 0, w, h);
    m.globalCompositeOperation = 'destination-in';
    m.fillStyle = m.createPattern(bayerMasks[Math.min(16, Math.floor(easeW(washT) * 17))], 'repeat');
    m.fillRect(0, 0, w, h);
    m.globalCompositeOperation = 'source-over';
    g.drawImage(mixCv, 0, 0);
  } else {
    houseOld = null;
    g.drawImage(houseCv, ix, iy, w, h, 0, 0, w, h);
  }
}
function drawFar(g, t, ix, iy, w, h){
  const fx = Math.floor(ix * FAR_PAR), fy = Math.floor(iy * FAR_PAR * 0.6);
  g.drawImage(farCv, fx, fy, w, h, 0, 0, w, h);
  g.fillStyle = 'rgba(226,236,244,0.75)';
  for (const d of RAIN){
    const y = (d.y + t * d.v) % 270 - 10, x = ((d.x - t * d.v * 0.18 - fx) % 460 + 460) % 460 - 6;
    g.fillRect(Math.round(x), Math.round(y), 1, 3);
  }
}
function drawHouseLive(g, t, ix, iy){
  PG = g;
  const X = x => x - ix, Y = y => y - iy;
  // 显示器里在下雨 + 闪烁的光标
  const sx = X(1257), sy = Y(397);
  for (let i = 0; i < 10; i++){
    const rx = sx + 1 + ((i * 13) % 29), ry = sy + Math.floor((t * 24 + i * 11) % 26) - 3;
    if (ry >= sy && ry + 2 < sy + 22) rect(rx, ry, 1, 2, '#9cc3da');
  }
  if ((t % 1) < 0.5) rect(sx + 3, sy + 17, 3, 1, '#e8f1f5');
  // 挂钟：真实时间
  const now = new Date(), cx = X(1305), cy = Y(330);
  const hr = (now.getHours() % 12 + now.getMinutes() / 60) / 12 * TAU, mn = (now.getMinutes() + now.getSeconds() / 60) / 60 * TAU;
  for (let i = 1; i <= 4; i++) dot(cx + Math.round(Math.sin(hr) * i), cy - Math.round(Math.cos(hr) * i), OUTL);
  for (let i = 1; i <= 6; i++) dot(cx + Math.round(Math.sin(mn) * i), cy - Math.round(Math.cos(mn) * i), HC.metal);
  dot(cx, cy, HC.red);
  // 主机的小绿灯
  dot(X(1255), Y(446), (t % 2.4) < 2 ? '#8fe07e' : '#3f6a3a');
  // 茶壶的热气：一缕一缕往上飘
  for (let k = 0; k < 2; k++){
    const ph = (t * 0.45 + k * 0.5) % 1;
    if (ph < 0.8) dot(X(984) + Math.round(Math.sin(ph * 9 + k) * 1.5), Y(443) - Math.floor(ph * 14), `rgba(255,255,255,${(0.8 - ph) * 0.9})`);
  }
  // 台灯 / 落地灯 / 灯笼的光（轻轻闪）
  g.globalAlpha = 0.85 + Math.sin(t * 2) * 0.1;   g.drawImage(GLOW_S, X(1343) - 16, Y(421) - 16);
  g.globalAlpha = 0.85 + Math.sin(t * 1.7) * 0.1; g.drawImage(GLOW_L, X(1710) - 30, Y(410) - 30);
  g.globalAlpha = 0.8 + Math.sin(t * 2.4) * 0.15; g.drawImage(GLOW_L, X(1415) - 30, Y(161) - 30);
  g.globalAlpha = 1;
}

/* ============================================================
   前景（离镜头最近）：比中景多移动 FG_PAR，颜色深一点
   位置按「镜头正对着它时它在哪」来摆；在屏幕上画（已经按像素缩放好）
   ============================================================ */
const FGC = { ol: '#21181a', wood: '#4b3628', woodLt: '#64493a', woodDk: '#352519', leaf: '#3f5e45', leafLt: '#557a5a', leafDk: '#2e4634', pot: '#7a4a35', potLt: '#94604a' };
const FG_PILLAR = (() => {
  const h = VIEW_H / PX + 40, c = pxCanvas(18, h), keep = PG;
  PG = c.getContext('2d');
  rect(0, 0, 18, h, FGC.ol); rect(1, 0, 16, h, FGC.wood); rect(3, 0, 2, h, FGC.woodLt); rect(14, 0, 2, h, FGC.woodDk);
  for (let y = 30; y < h; y += 70){ rect(0, y, 18, 4, FGC.ol); rect(1, y + 1, 16, 2, FGC.woodDk); }
  PG = keep;
  return c;
})();
function makeIvy(n, seed){
  const c = pxCanvas(24, n * 10 + 8), keep = PG;
  PG = c.getContext('2d');
  let px = 12;
  for (let i = 0; i < n * 10; i++){ px = 12 + Math.round(Math.sin(i * 0.13 + seed) * 3); dot(px, i, FGC.leafDk); }
  for (let i = 1; i <= n; i++){
    const y = i * 10 - 4, x = 12 + Math.round(Math.sin(y * 0.13 + seed) * 3), side = i % 2 ? 1 : -1;
    const lx = side > 0 ? x + 1 : x - 6;
    rect(lx, y, 6, 3, FGC.ol); rect(lx + 1, y - 1, 4, 5, FGC.ol); rect(lx + 1, y, 4, 3, FGC.leaf); dot(lx + (side > 0 ? 2 : 3), y, FGC.leafLt);
  }
  PG = keep;
  return c;
}
const FG_IVY = [[150, A_CE, 7], [590, A_CE, 6], [1500, A_CE, 8], [1025, A_MZ + 8, 5]].map(([x, y, n], i) => ({ x, y, c: makeIvy(n, i * 2.3) }));
const FG_POT = (() => {
  const c = pxCanvas(40, 64), keep = PG;
  PG = c.getContext('2d');
  for (const [x0, h, lean] of [[13, 44, -0.18], [17, 54, -0.05], [21, 50, 0.08], [25, 40, 0.2], [19, 34, -0.3]]){
    for (let j = 0; j < h; j++){
      const x = Math.round(x0 + lean * j), w = j < h - 6 ? 2 : (j < h - 2 ? 1 : 0), y = 44 - j;
      rect(x - w - 1, y, w * 2 + 3, 1, FGC.ol);
      if (w) rect(x - w, y, w * 2 + 1, 1, j % 9 < 2 ? FGC.leafLt : FGC.leaf);
    }
  }
  for (let j = 0; j < 20; j++){ const w = 14 - Math.floor(j / 4); rect(20 - w, 44 + j, w * 2 + 1, 1, FGC.ol); if (j && j < 19) rect(21 - w, 44 + j, w * 2 - 1, 1, j < 3 ? FGC.potLt : FGC.pot); }
  PG = keep;
  return c;
})();
/* camX / camY：镜头左上角（像素，可以是小数）；q：对齐到屏幕像素的取整 */
function drawForeground(c2, t, camX, camY, q){
  const VW = VIEW_W / PX, VH = VIEW_H / PX;
  const at = (ax, ay) => [q((ax - camX) + (ax - camX - VW / 2) * FG_PAR), q((ay - camY) + (ay - camY - VH / 2) * FG_PAR * 0.4)];
  for (const v of FG_IVY){
    const [x, y] = at(v.x, v.y);
    if (x < -30 || x > VW + 30) continue;
    c2.drawImage(v.c, x - 12 + Math.round(Math.sin(t * 0.9 + v.x)), y);
  }
  for (const ax of [700, 1490]){
    const [x] = at(ax, 0);
    if (x < -30 || x > VW + 30) continue;
    c2.drawImage(FG_PILLAR, x - 9, -20);
  }
  for (const ax of [300, 1170, 1590]){
    const [x, y] = at(ax, A_FL);
    if (x < -40 || x > VW + 40) continue;
    c2.drawImage(FG_POT, x - 20, y - 54);
  }
}
