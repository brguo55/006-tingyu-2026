"use strict";
/* ============================================================
   听雨 · 舞台 —— 纸上的 2D 小房间
   engine.js：小工具 / 画布 / 纸纹 / 手绘笔触 / 面板让位
   纯 Canvas 2D，零依赖
   ============================================================ */

/* ---------- 小工具 ---------- */
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function hash(n){ const s = Math.sin(n) * 43758.5453; return s - Math.floor(s); }

/* ---------- 画布 ---------- */
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
let SC = 1;   // 屏幕尺寸基准：按 CSS 像素写死

/* 舞台可用区域：右侧被面板占去 insetR 像素时，房间放在剩下区域的中间。
   CX 每帧缓动到 cxTo（main.js），面板开合时平滑挪位。 */
let insetR = 0, CX = 0, cxTo = 0;
function sceneLayout(){ cxTo = Math.max(240, W - insetR) / 2; }
function setSceneInset(px){ insetR = px; sceneLayout(); }
function resize(){
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR);
  cv.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  sceneLayout();
  if (!CX) CX = cxTo;   // 首次直接到位
  makePaper();
}

/* ---------- 纸纹背景（一次性生成） ---------- */
const paper = document.createElement('canvas');
function makePaper(){
  // 按物理像素生成 → 纸纹颗粒与页面缩放无关
  const pw = Math.max(2, Math.round(W * DPR)), ph = Math.max(2, Math.round(H * DPR));
  paper.width = pw; paper.height = ph;
  const p = paper.getContext('2d', { willReadFrequently: true });
  p.setTransform(DPR, 0, 0, DPR, 0, 0);
  p.fillStyle = `rgb(${PAPER[0]},${PAPER[1]},${PAPER[2]})`;
  p.fillRect(0, 0, W, H);
  // 低频斑驳
  for (let i = 0; i < 14; i++){
    const x = rnd(0, W), y = rnd(0, H), r = rnd(60, 240);
    const g = p.createRadialGradient(x, y, 0, x, y, r);
    const warm = Math.random() < 0.5 ? '214,199,172' : '233,226,209';
    g.addColorStop(0, `rgba(${warm},0.045)`);
    g.addColorStop(1, `rgba(${warm},0)`);
    p.fillStyle = g;
    p.fillRect(x-r, y-r, r*2, r*2);
  }
  // 细噪（逐物理像素）
  const id = p.getImageData(0, 0, pw, ph), d = id.data;
  for (let i = 0; i < d.length; i += 4){
    const n = (Math.random() - 0.5) * 11;
    d[i] += n; d[i+1] += n * 0.95; d[i+2] += n * 0.85;
  }
  p.putImageData(id, 0, 0);
  // 短纤维
  p.lineCap = 'round';
  for (let i = 0; i < pw * ph / 1500; i++){
    const x = rnd(0, W), y = rnd(0, H), a = rnd(0, TAU), l = rnd(5, 13);
    p.strokeStyle = `rgba(${Math.random()<0.5?'196,182,156':'232,224,204'},${rnd(0.05,0.1)})`;
    p.lineWidth = rnd(0.5, 1.1);
    p.beginPath(); p.moveTo(x, y); p.lineTo(x + Math.cos(a)*l, y + Math.sin(a)*l); p.stroke();
  }
  // 极轻暗角
  const vg = p.createRadialGradient(W/2, H/2, Math.min(W, H)*0.44, W/2, H/2, Math.hypot(W, H)*0.6);
  vg.addColorStop(0, 'rgba(198,182,152,0)');
  vg.addColorStop(1, 'rgba(198,182,152,0.15)');
  p.fillStyle = vg;
  p.fillRect(0, 0, W, H);
}

/* ---------- 手绘笔触（画布上的控件用：每段粗细 / 浓淡略有不同） ---------- */
function pen(pts, ink, w, alpha, seed, gap, overdraw){
  if (!pts || pts.length < 2) return;
  w *= SC;
  for (let i = 0; i < pts.length - 1; i++){
    const h = hash(seed*13.7 + i*3.1);
    if (gap && h < gap) continue;
    ctx.strokeStyle = `rgba(${ink[0]},${ink[1]},${ink[2]},${Math.min(1, alpha*(0.78+0.34*h))})`;
    ctx.lineWidth = w * (0.72 + 0.6 * hash(seed + i*7.3));
    ctx.beginPath();
    ctx.moveTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[i+1][0], pts[i+1][1]);
    ctx.stroke();
  }
  if (overdraw !== false){
    ctx.strokeStyle = `rgba(${ink[0]},${ink[1]},${ink[2]},${alpha*0.26})`;
    ctx.lineWidth = w * 0.5;
    ctx.beginPath();
    ctx.moveTo(pts[0][0]+1.4*SC, pts[0][1]+1.0*SC);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0]+1.4*SC, pts[i][1]+1.0*SC);
    ctx.stroke();
  }
}
function fillPoly(pts, rgb, a){
  if (!pts || pts.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
  ctx.fill();
}
