"use strict";
/* ============================================================
   app/pomodoro.js：番茄钟 —— 专注 / 短休息 / 长休息，可关联任务，统计，沉浸模式
   ------------------------------------------------------------
   计时按「结束时刻」算，不靠累加：窗口在后台被浏览器降频也不会走慢；
   滴答由一个小 Worker 发出（后台页面里普通定时器可能被压到一分钟一次）。
   进行中的计时存在 KV 'timer'：刷新 / 关掉再开都能接着走；离开期间到点的番茄照样记上。
   ============================================================ */

const MODES = {
  focus: { name: '专注',   key: 'focusMin' },
  short: { name: '短休息', key: 'shortMin' },
  long:  { name: '长休息', key: 'longMin' },
};

const Pomo = {
  t: { mode: 'focus', running: false, endAt: 0, left: 25 * 60e3, startedAt: 0, cycle: 0, taskId: null },
  el: {},

  dur(mode = this.t.mode){ return (Store.data.settings[MODES[mode].key] || 25) * 60e3; },
  remaining(){ return this.t.running ? Math.max(0, this.t.endAt - Date.now()) : this.t.left; },
  _save(){ KV.set('timer', this.t); },

  async init(){
    const saved = await KV.get('timer');
    if (saved) Object.assign(this.t, saved);
    else this.t.left = this.dur('focus');
    if (this.t.running && this.t.endAt <= Date.now()) this.finish(true);   // 离开期间到点了
    // 滴答：优先用 Worker（后台不被降频），不行就退回普通定时器
    try {
      const w = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 500)'], { type: 'text/javascript' })));
      w.onmessage = () => this.tick();
    } catch (e){ setInterval(() => this.tick(), 500); }
    this.tick();
  },
  tick(){
    if (this.t.running && Date.now() >= this.t.endAt) return this.finish(false);
    this.paint();
  },

  /* ---------- 控制 ---------- */
  start(){
    initAudio();
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    const t = this.t;
    if (!t.left || t.left <= 0) t.left = this.dur();
    t.endAt = Date.now() + t.left;
    if (!t.startedAt) t.startedAt = Date.now();
    t.running = true;
    this._save(); this.refresh();
  },
  pause(){
    const t = this.t;
    t.left = Math.max(0, t.endAt - Date.now());
    t.running = false;
    this._save(); this.refresh();
  },
  reset(){
    Object.assign(this.t, { running: false, left: this.dur(), startedAt: 0 });
    this._save(); this.refresh();
  },
  setMode(mode){
    Object.assign(this.t, { mode, running: false, left: this.dur(mode), startedAt: 0 });
    this._save(); this.refresh();
  },
  skip(){ this.setMode(this.t.mode === 'focus' ? this._nextBreak(this.t.cycle + 1) : 'focus'); },
  _nextBreak(cycle){ return cycle % (Store.data.settings.longEvery || 4) === 0 ? 'long' : 'short'; },
  setTask(id){ this.t.taskId = id || null; this._save(); this.refresh(); },

  /* 到点：记一个番茄 → 响铃 + 系统通知 → 切到下一段（等你点开始） */
  finish(silent){
    const t = this.t, end = t.running ? t.endAt : Date.now();
    let msg;
    if (t.mode === 'focus'){
      const minutes = Math.round(this.dur('focus') / 60e3);
      Store.update(d => d.pomos.push({ id: uid(), start: t.startedAt || end - this.dur('focus'), end, minutes, taskId: t.taskId }));
      t.cycle++;
      msg = ['专注完成', `完成第 ${this._today().count} 个番茄，休息一下吧。`];
      this.setMode(this._nextBreak(t.cycle));
      if (!silent) celebrate();
    } else {
      msg = ['休息结束', '准备好了就开始下一个番茄。'];
      this.setMode('focus');
    }
    if (silent) { toast(`离开期间：${msg[0]}`); return; }
    bell();
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden){
      try { new Notification(msg[0] + ' · 听雨', { body: msg[1], icon: 'icons/icon-192.png', silent: true }); } catch (e){}
    }
    toast(msg[0] + '。' + msg[1]);
  },

  _today(){
    const k = dayKey(), ps = Store.data.pomos.filter(p => dayKey(new Date(p.end)) === k);
    return { count: ps.length, minutes: ps.reduce((s, p) => s + (p.minutes || 0), 0) };
  },

  /* ---------- 界面 ---------- */
  mount(root){
    const e = this.el;
    e.modes = h('div.modes');
    e.time = h('div.big-time');
    e.ring = h('div.pomo-ring', null, e.time);
    e.btns = h('div.pomo-btns');
    e.task = h('select.pomo-task', { onchange: ev => this.setTask(ev.target.value) });
    e.stats = h('div.pomo-stats');
    e.week = h('div.week-bars');
    e.cfg = h('details.pomo-cfg', null, h('summary', null, '时长设置'), h('div.cfg-grid'));
    root.append(e.modes, e.ring, e.btns, h('label.pomo-task-row', null, '专注于 ', e.task), e.stats, e.week, e.cfg);

    // 沉浸模式：面板收起，场景铺满，计时浮在水景上方
    e.imm = h('div#immersive', null,
      h('div.imm-mode'), h('div.imm-time'), h('div.imm-task'),
      h('div.imm-btns', null,
        h('button.btn.imm-toggle', { onclick: () => this.t.running ? this.pause() : this.start() }),
        h('button.btn.ghost', { onclick: () => App.immersive(false) }, '退出沉浸')));
    document.body.append(e.imm);
  },
  refresh(){
    const e = this.el, t = this.t, s = Store.data.settings;
    if (!e.modes) return;
    e.modes.replaceChildren(...Object.entries(MODES).map(([k, m]) =>
      h('button.chip' + (t.mode === k ? '.on' : ''), { onclick: () => this.setMode(k), disabled: t.running }, m.name)));
    const started = t.running || t.left < this.dur();
    e.btns.replaceChildren(
      t.running ? h('button.btn.primary', { onclick: () => this.pause() }, '暂停')
                : h('button.btn.primary', { onclick: () => this.start() }, started ? '继续' : '开始'),
      started ? h('button.btn.ghost', { onclick: () => this.reset() }, '重置') : null,
      h('button.btn.ghost', { onclick: () => this.skip(), title: '直接进入下一段，不计数' }, '跳过'),
      h('button.btn.ghost', { onclick: () => App.immersive(true) }, '沉浸'),
    );
    const undone = Store.data.tasks.filter(x => !x.done || x.id === t.taskId);
    e.task.replaceChildren(h('option', { value: '' }, '不关联任务'),
      ...undone.map(x => h('option', { value: x.id, selected: x.id === t.taskId }, x.title)));

    // 今日 + 最近 7 天
    const td = this._today(), total = Store.data.pomos.length;
    e.stats.replaceChildren(
      h('div.stat', null, h('b', null, td.count), h('span', null, '今日番茄')),
      h('div.stat', null, h('b', null, td.minutes), h('span', null, '今日专注（分钟）')),
      h('div.stat', null, h('b', null, total), h('span', null, '累计番茄')),
    );
    const days = [...Array(7)].map((_, i) => addDays(dayKey(), i - 6));
    const counts = days.map(k => Store.data.pomos.filter(p => dayKey(new Date(p.end)) === k).length);
    const max = Math.max(4, ...counts);
    e.week.replaceChildren(...days.map((k, i) => h('div.wb', { title: `${k}：${counts[i]} 个番茄` },
      h('div.wb-bar', { style: { height: (counts[i] / max * 100) + '%' } }),
      h('div.wb-n', null, counts[i] || ''),
      h('div.wb-d', null, i === 6 ? '今' : WEEK[keyToDate(k).getDay()]))));

    // 时长设置
    const grid = e.cfg.querySelector('.cfg-grid');
    const num = (label, key, min, max) => h('label', null, label,
      h('input', { type: 'number', min, max, value: s[key], onchange: ev => {
        const v = Math.min(max, Math.max(min, Math.round(+ev.target.value) || s[key]));
        Store.update(d => { d.settings[key] = v; });
        if (!this.t.running && !this.t.startedAt) this.setMode(this.t.mode);   // 还没开始的这段按新时长重置
      } }));
    grid.replaceChildren(num('专注（分钟）', 'focusMin', 1, 120), num('短休息', 'shortMin', 1, 60),
      num('长休息', 'longMin', 1, 90), num('几个番茄后长休息', 'longEvery', 2, 12));
    this.paint();
  },
  /* 每次滴答只更新数字（便宜） */
  paint(){
    const e = this.el, t = this.t;
    if (!e.time) return;
    const left = this.remaining(), txt = mmss(left);
    const frac = 1 - left / this.dur();
    e.time.textContent = txt;
    e.ring.style.setProperty('--p', (Math.max(0, Math.min(1, frac)) * 360).toFixed(1) + 'deg');
    e.ring.classList.toggle('running', t.running);
    const task = Store.data.tasks.find(x => x.id === t.taskId);
    e.imm.querySelector('.imm-mode').textContent = MODES[t.mode].name + (t.running ? '' : ' · 已暂停');
    e.imm.querySelector('.imm-time').textContent = txt;
    e.imm.querySelector('.imm-task').textContent = task ? task.title : '';
    e.imm.querySelector('.imm-toggle').textContent = t.running ? '暂停' : (t.left < this.dur() ? '继续' : '开始');
    document.title = t.running ? `${txt} ${MODES[t.mode].name} · 听雨` : '听雨';
    App.timerBadge(t.running ? txt : '');
  },
};
