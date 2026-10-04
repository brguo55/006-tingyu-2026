"use strict";
/* ============================================================
   app/app.js：外壳 —— 右侧手绘面板（任务 / 番茄 / 习惯 / 设置）、
   备份提醒横幅、沉浸模式、跟着水色变的面板配色、启动流程
   ============================================================ */

const TABS = [
  { id: 'tasks',  name: '任务', mod: Tasks },
  { id: 'matrix', name: '轻重', mod: Matrix },      // 四象限（艾森豪威尔矩阵）
  { id: 'pomo',   name: '番茄', mod: Pomo },
  { id: 'habits', name: '习惯', mod: Habits },
  { id: 'count',  name: '倒数', mod: Countdown },   // 倒数日
  { id: 'set',    name: '设置', mod: Settings },
];
const PANEL_W = 380, PANEL_GAP = 16, NARROW = 760;

/* 只是本机界面习惯（开没开面板、上次在哪个页签），不算数据，放 localStorage */
const ui = (() => { try { return JSON.parse(localStorage.getItem('tingyu-ui')) || {}; } catch (e){ return {}; } })();
const saveUi = () => { try { localStorage.setItem('tingyu-ui', JSON.stringify(ui)); } catch (e){} };

const App = {
  tab: ui.tab || 'tasks',
  open: ui.open !== false,
  el: {},

  build(){
    const e = this.el;
    e.tabs = h('nav.tabs', null, ...TABS.map(t => h('button.tab', { 'data-tab': t.id, onclick: () => this.showTab(t.id) }, t.name)));
    e.banner = h('div.banner');
    e.body = h('div.panel-body');
    e.sections = {};
    for (const t of TABS){
      const sec = h('section.tab-page', { 'data-tab': t.id });
      t.mod.mount(sec);
      e.sections[t.id] = sec;
      e.body.append(sec);
    }
    e.panel = h('aside#panel', null,
      h('header.panel-head', null,
        h('div.brand', null, h('span.brand-name', null, '听雨'), h('span.brand-date', null, this._dateLine())),
        h('button.icon-btn', { title: '收起面板', onclick: () => this.setOpen(false) }, '›')),
      e.tabs, e.banner, e.body);
    e.opener = h('button#opener', { title: '打开面板', onclick: () => this.setOpen(true) }, h('span.op-name', null, '听雨'), h('span.op-timer'));
    document.body.append(e.panel, e.opener);
    addEventListener('resize', () => this.layout());
    addEventListener('keydown', ev => { if (ev.key === 'Escape' && document.body.classList.contains('immersive')) this.immersive(false); });
  },
  _dateLine(){ const d = new Date(); return `${d.getMonth() + 1}月${d.getDate()}日 · 周${WEEK[d.getDay()]}`; },

  showTab(id){
    this.tab = id; ui.tab = id; saveUi();
    for (const b of this.el.tabs.children) b.classList.toggle('on', b.dataset.tab === id);
    for (const [k, s] of Object.entries(this.el.sections)) s.hidden = k !== id;
    if (!this.open) this.setOpen(true);
    this.render();
  },
  render(){
    TABS.find(t => t.id === this.tab).mod.refresh();
    this.renderBanner();
  },
  renderBanner(){
    const B = Backup, kids = [];
    if (B.perm === 'prompt'){
      kids.push(h('span', null, '自动备份需要重新授权'), h('button.btn.small', { onclick: () => B.reconnect() }, '重新连接'));
    } else if (B.overdue()){
      const days = Math.floor((Date.now() - (B.info.lastAt || Store.data.meta.createdAt)) / 864e5);
      kids.push(h('span', null, B.info.lastAt ? `已经 ${days} 天没备份了` : '还没有备份过'),
        h('button.btn.small', { onclick: () => B.exportFile() }, '导出'),
        B.supported ? h('button.btn.small.ghost', { onclick: () => this.showTab('set') }, '设置自动备份') : null);
    }
    this.el.banner.replaceChildren(...kids);
    this.el.banner.hidden = !kids.length;
  },

  /* ---------- 面板开合 + 场景让位 ---------- */
  setOpen(open){
    this.open = open; ui.open = open; saveUi();
    document.body.classList.toggle('panel-closed', !open);
    this.layout();
  },
  layout(){
    const narrow = innerWidth < NARROW, immersive = document.body.classList.contains('immersive');
    document.body.classList.toggle('narrow', narrow);
    setSceneInset(this.open && !narrow && !immersive ? PANEL_W + PANEL_GAP * 2 : 0);
  },
  immersive(on){
    document.body.classList.toggle('immersive', on);
    this.layout();
    Pomo.paint();
  },
  timerBadge(txt){ if (this.el.opener) this.el.opener.querySelector('.op-timer').textContent = txt; },

  /* 面板配色跟着水色走：淡彩 / 深一阶 / 亮部 */
  themeVars(){
    const s = document.documentElement.style, P = THEMES[themeIdx];
    s.setProperty('--wash', `rgb(${P.W})`);
    s.setProperty('--wash-dk', `rgb(${P.DK})`);
    s.setProperty('--wash-lt', `rgb(${P.LT})`);
  },
};

/* 画布上换了颜色 / 静音（点色板、小喇叭，或按 M）→ 记下来 */
function onSceneChange(){
  App.themeVars();
  if (!Store.data) return;
  const s = Store.data.settings;
  if (s.theme === themeIdx && s.muted === muted) return;
  Store.update(d => { d.settings.theme = themeIdx; d.settings.muted = muted; });
}
/* 导入 / 恢复了一份备份之后：把颜色、小人和静音也调成备份里的设置 */
function onDataReplaced(){
  const s = Store.data.settings;
  setThemeNow(s.theme);
  Chibi.setMode(s.companion);
  setMuted(s.muted);
  App.themeVars();
  Pomo.refresh();
}

/* ---------- 启动 ---------- */
(async function boot(){
  try {
    await Store.load();
  } catch (err){
    document.body.append(h('div.fatal', null, '无法打开本机数据库：' + (err && err.message || err) + '。请确认没有在无痕模式下打开。'));
    return;
  }
  const s = Store.data.settings;
  setThemeNow(s.theme); Chibi.setMode(s.companion); muted = s.muted;
  App.themeVars();
  const wasOpen = App.open;
  App.build();
  // 面板一出现就要能响应改动：先订阅，再做其余可能要等的初始化
  Store.subscribe((local, quiet) => {
    if (quiet) App.renderBanner(); else App.render();
    if (local) Backup.schedule();
  });
  Backup.subscribe(() => { App.renderBanner(); if (App.tab === 'set') Settings.refresh(); });
  await Backup.init();
  await Pomo.init();
  App.showTab(App.tab);
  App.setOpen(wasOpen);    // showTab 会顺手打开面板；还原成上次的开合状态
  // 跨过午夜：「今天」要换一天
  let lastDay = dayKey();
  setInterval(() => { if (dayKey() !== lastDay){ lastDay = dayKey(); App.render(); } }, 60e3);

  // 离线可用：只在 http(s) 下注册（直接双击打开的 file:// 不支持）
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')){
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
