"use strict";
/* ============================================================
   ui.js：画在画布上的手绘控件 —— 底部主题色板 / 左上角静音
   ============================================================ */

/* ---------- 主题色板（画面底部一行 · 钢笔手绘小方块，与底座同风格） ---------- */
const NSWATCH = 7;
const swShapes = [];   // 每个色板的抖动方形（局部坐标，固定不闪）
for (let i = 0; i < NSWATCH; i++){
  const pts = [];
  const cs = [[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]];
  for (let e = 0; e < 4; e++){
    const a = cs[e], b = cs[(e+1)%4];
    for (let k = 0; k < 4; k++){
      const t = k/4;
      pts.push([ a[0]+(b[0]-a[0])*t + rnd(-0.045,0.045), a[1]+(b[1]-a[1])*t + rnd(-0.045,0.045) ]);
    }
  }
  pts.push(pts[0]);
  swShapes.push(pts);
}
let hoverIdx = -1;
const SW_BASE = 34, SW_GAP = 20;
function swatchPos(i){
  const act = i === themeIdx, hov = i === hoverIdx;
  return {
    cx: CX + (i - (NSWATCH-1)/2)*(SW_BASE + SW_GAP)*SC,
    cy: H - (58 + (act ? 4 : (hov ? 2 : 0)))*SC,
    s: (act ? 40 : (hov ? 37 : SW_BASE))*SC
  };
}
function hitSwatch(px, py){
  for (let i = 0; i < NSWATCH; i++){
    const { cx, cy, s } = swatchPos(i);
    if (Math.abs(px - cx) < s*0.62 && Math.abs(py - cy) < s*0.62) return i;
  }
  return -1;
}
function drawSwatches(){
  for (let i = 0; i < NSWATCH; i++){
    const { cx, cy, s } = swatchPos(i);
    const act = i === themeIdx;
    const P = THEMES[i];
    const pts = swShapes[i].map(p => [cx + p[0]*s, cy + p[1]*s]);
    // 水彩填充（透出纸纹）
    ctx.fillStyle = `rgba(${P.W[0]},${P.W[1]},${P.W[2]},${act ? 0.9 : 0.72})`;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.closePath();
    ctx.fill();
    // 水彩错位叠层
    ctx.save();
    ctx.translate(1.6*SC, 1.2*SC);
    ctx.fillStyle = `rgba(${P.W[0]},${P.W[1]},${P.W[2]},${act ? 0.35 : 0.26})`;
    ctx.fill();
    ctx.restore();
    // 钢笔勾边（与底座棱线同款笔触，笔宽由 pen 统一随视口缩放）
    pen(pts, INK, act ? 1.8 : 1.4, act ? 0.9 : 0.68, i*43.7, 0.04);
    // 当前主题：色板下添一道短横线
    if (act) pen([[cx-10*SC, cy + s*0.62 + 8*SC],[cx+10*SC, cy + s*0.62 + 8*SC]], INK, 1.6, 0.72, i*17.3, 0);
  }
}

const IC_SNOW = [212,224,232];   // 静音按钮的淡彩
const wj = a => rnd(-a, a);       // 手抖（局部坐标预生成 → 每帧不闪）

/* ---------- 静音（画面左上角 · 钢笔手绘小喇叭：有声时两道声波，静音时一个叉） ---------- */
const icSpeaker = [[-0.36,-0.12],[-0.16,-0.12],[0.06,-0.32],[0.06,0.32],[-0.16,0.12],[-0.36,0.12]]
  .map(q => [q[0] + wj(0.015), q[1] + wj(0.015)]);
icSpeaker.push(icSpeaker[0]);
const icWaves = [0.17, 0.31].map(r => {
  const pts = [];
  for (let k = 0; k <= 6; k++){ const a = -0.85 + k/6*1.7; pts.push([0.08 + Math.cos(a)*r + wj(0.008), Math.sin(a)*r + wj(0.008)]); }
  return pts;
});
const icCross = [[[0.2,-0.12],[0.42,0.12]], [[0.2,0.12],[0.42,-0.12]]];
let muteHover = false;
function muteBtnPos(){ return { cx: 42*SC, cy: (54 - (muteHover ? 2 : 0))*SC, s: (muteHover ? 35 : 32)*SC }; }
function hitMuteBtn(px, py){
  const { cx, cy, s } = muteBtnPos();
  return Math.abs(px - cx) < s*0.62 && Math.abs(py - cy) < s*0.62;
}
function drawMuteBtn(){
  const { cx, cy, s } = muteBtnPos();
  const at = q => [cx + q[0]*s, cy + q[1]*s];
  const ia = muteHover ? 0.85 : 0.65;
  const pts = icSpeaker.map(at);
  fillPoly(pts, IC_SNOW, muted ? 0.45 : 0.75, false);
  pen(pts, INK, 1.3, ia, 61.7, 0.04);
  if (muted) icCross.forEach((l, k) => pen(l.map(at), INK, 1.5, ia, 71.3 + k*3.1, 0, false));
  else icWaves.forEach((l, k) => pen(l.map(at), INK, 1.2, ia * (k ? 0.75 : 1), 81.9 + k*4.7, 0, false));
}
