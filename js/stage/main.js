"use strict";
/* ============================================================
   main.js：主循环 + 交互 + 启动
   ============================================================ */

/* ---------- 主循环 ---------- */
let lastT = 0;
function frame(now){
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
  lastT = now;
  CX += (cxTo - CX) * Math.min(1, dt * 7);                       // 面板开合：房间缓动到位
  if (washT < 1) washT = Math.min(1, washT + dt / WASH_DUR);     // 换主题：地毯 / 墙色慢慢晕开
  Room.update(dt);

  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(paper, 0, 0, W, H);
  Room.draw();
  drawSwatches();
  drawMuteBtn();
  requestAnimationFrame(frame);
}

/* 完成一件事（任务 / 打卡 / 番茄）：骑士举杯 */
function celebrate(){ Room.doCheer(); }

/* ---------- 交互：点骑士举杯 / 点小鸟 / 色板 / 静音；眼睛跟着鼠标 ---------- */
cv.addEventListener('pointerdown', e => {
  initAudio();
  const sw = hitSwatch(e.clientX, e.clientY);
  if (sw >= 0){ switchTheme(sw); return; }                        // 点色板：换颜色
  if (hitMuteBtn(e.clientX, e.clientY)){ toggleMute(); return; }  // 点小喇叭：静音 / 恢复
  Room.click(e.clientX, e.clientY);
});
cv.addEventListener('pointermove', e => {
  Room.pointer = [e.clientX, e.clientY];
  const h = hitSwatch(e.clientX, e.clientY), hm = hitMuteBtn(e.clientX, e.clientY), hc = Room.hit(e.clientX, e.clientY);
  if (h !== hoverIdx || hm !== muteHover){ hoverIdx = h; muteHover = hm; }
  cv.style.cursor = (h >= 0 || hm || hc) ? 'pointer' : '';
});
cv.addEventListener('pointerleave', () => { Room.pointer = null; });

/* ---------- 键盘 ---------- */
/* 正在面板的输入框里打字时，不触发快捷键 */
const typing = e => { const t = e.target; return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); };
window.addEventListener('keydown', initAudio);
// 屏蔽浏览器缩放快捷键（⌘/Ctrl + +/−/0）：画面已按视口自适应
window.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) &&
      (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_' || e.key === '0' ||
       e.key === ')' || e.key === '(')) e.preventDefault();
});
// WASD 移动、E 互动、M 静音 / 恢复（用 e.code：中文输入法开着也认得）
window.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || typing(e)) return;
  if (Room.keyDown(e.code)) { e.preventDefault(); return; }
  if (e.code === 'KeyM') toggleMute();
});
window.addEventListener('keyup', e => Room.keyUp(e.code));
// 切走窗口 / 开始在输入框里打字：松开所有方向键，免得骑士一直走
window.addEventListener('blur', () => Room.clearKeys());
document.addEventListener('focusin', e => { if (typing(e)) Room.clearKeys(); });

/* ---------- 启动 ---------- */
window.addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);
