"use strict";
/* ============================================================
   app/util.js：DOM 小工具 / 日期 / id
   ============================================================ */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* h('button#id.btn.primary', { onclick }, '文字', child…)：建元素。文字一律走 textContent，不拼 HTML */
function h(tag, attrs, ...kids){
  const [head, ...cls] = tag.split('.');
  const [name, id] = head.split('#');
  const el = document.createElement(name || 'div');
  if (id) el.id = id;
  if (cls.length) el.className = cls.join(' ');
  for (const [k, v] of Object.entries(attrs || {})){
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') for (const [p, x] of Object.entries(v)) el.style.setProperty(p.replace(/[A-Z]/g, c => '-' + c.toLowerCase()), x);
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()){
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* 日期统一用本地时区的 'YYYY-MM-DD' 字符串 */
const pad2 = n => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const keyToDate = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = keyToDate(k); d.setDate(d.getDate() + n); return dayKey(d); };
const WEEK = '日一二三四五六';

/* 截止日期的口语说法：今天 / 明天 / 昨天 / 周三 / 10月5日 */
function dueLabel(k){
  const t = dayKey(), diff = Math.round((keyToDate(k) - keyToDate(t)) / 864e5);
  if (diff === 0) return '今天';
  if (diff === 1) return '明天';
  if (diff === -1) return '昨天';
  const d = keyToDate(k);
  if (diff > 1 && diff < 7) return '周' + WEEK[d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日` + (d.getFullYear() !== new Date().getFullYear() ? `（${d.getFullYear()}）` : '');
}

/* 「3 分钟前」 */
function ago(ts){
  if (!ts) return '从未';
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return '刚刚';
  if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
  if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
  return Math.floor(s / 86400) + ' 天前';
}

const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`; };

/* 轻提示（右下角一张小纸条，几秒后消失） */
function toast(msg){
  const el = h('div.toast', null, msg);
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 2600);
}

/* 防抖；flush() 立刻执行还没执行的那一次（没有待执行的就什么都不做） */
function debounce(fn, ms){
  let t = 0, pending = false;
  const run = () => { pending = false; fn(); };
  const d = () => { pending = true; clearTimeout(t); t = setTimeout(run, ms); };
  d.flush = () => { clearTimeout(t); if (pending) run(); };
  return d;
}
