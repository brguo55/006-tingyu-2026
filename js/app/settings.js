"use strict";
/* ============================================================
   app/settings.js：设置页 —— 备份（最重要）/ 陪伴的小人 / 声音 / 安装 / 关于
   ============================================================ */

const Settings = {
  el: {},
  installEvt: null,

  mount(root){
    this.el.root = root;
    this.el.file = h('input', { type: 'file', accept: '.json,application/json', hidden: true,
      onchange: e => { const f = e.target.files[0]; e.target.value = ''; if (f) Backup.importFile(f); } });
    document.body.append(this.el.file);
    addEventListener('beforeinstallprompt', e => { e.preventDefault(); this.installEvt = e; this.refresh(); });
  },

  refresh(){
    const B = Backup, d = Store.data;
    const kids = [];

    /* ---------- 备份 ---------- */
    const statusTxt = B.info.lastAt
      ? `上次备份：${ago(B.info.lastAt)}（${B.info.kind === 'folder' ? '自动备份到文件夹' : '手动导出'}）`
      : '还没有备份过';
    const folder = [];
    if (B.perm === 'unsupported'){
      folder.push(h('p.muted', null, '当前浏览器不支持自动备份到文件夹。请用电脑上的 Chrome 或 Edge 打开听雨，就能开启自动备份。'));
    } else if (B.perm === 'none'){
      folder.push(
        h('p', null, '选一个由网盘同步的文件夹（Google Drive / OneDrive / Dropbox），之后每次改动都会自动写一份备份进去，每天另存一份快照，保留最近 30 天。'),
        h('button.btn.primary', { onclick: () => B.chooseFolder() }, '选择备份文件夹'));
    } else {
      folder.push(h('p', null, '自动备份到：', h('b', null, B.info.folder || (B.dir && B.dir.name) || '文件夹'),
        B.perm === 'granted' ? (B.error ? h('span.warn', null, ` · 出错：${B.error}`) : h('span.ok', null, ' · 正常')) : h('span.warn', null, ' · 需要重新授权')));
      if (B.perm === 'prompt') folder.push(h('button.btn.primary', { onclick: () => B.reconnect() }, '重新连接文件夹'));
      folder.push(h('div.btn-row', null,
        B.perm === 'granted' ? h('button.btn', { onclick: async () => { await B.writeFolder(true); toast('已备份'); } }, '立即备份') : null,
        B.perm === 'granted' ? h('button.btn.ghost', { onclick: () => B.restoreFromFolder() }, '从文件夹恢复') : null,
        h('button.btn.ghost', { onclick: () => B.chooseFolder() }, '换一个文件夹'),
        h('button.btn.ghost', { onclick: () => { if (confirm('停止自动备份？文件夹里已有的备份不会删除。')) B.stopFolder(); } }, '停用')));
    }
    kids.push(h('section.set', null,
      h('h3', null, '备份'),
      h('p.backup-status' + (B.overdue() ? '.warn' : ''), null, statusTxt),
      h('h4', null, '自动备份到文件夹'), ...folder,
      h('h4', null, '手动导出 / 导入'),
      h('p', null, '随时导出一份备份文件；换电脑时，在新电脑上导入即可。'),
      h('div.btn-row', null,
        h('button.btn', { onclick: () => B.exportFile() }, '导出备份文件'),
        h('button.btn.ghost', { onclick: () => this.el.file.click() }, '导入备份文件')),
      h('ul.tips', null,
        h('li', null, '数据只存在这台电脑的浏览器里，不会上传到任何服务器，也不会上传到 GitHub。'),
        h('li', null, '备份文件夹千万不要放在 GitHub 仓库的文件夹里——仓库是公开的。'),
        h('li', null, '清除浏览器的「Cookie 和网站数据」、卸载 App 时勾选「同时清除数据」，都会删掉本机数据；有备份就能找回。'),
        h('li', null, B.persisted ? '浏览器已答应：空间紧张时也不会自动清掉听雨的数据。' : '建议用 Chrome / Edge 并安装成 App，数据更稳；Safari 会清掉一段时间没打开的网站数据。'))));

    /* ---------- 陪伴的小人 ---------- */
    const pick = (mode, label) => h('button.chip' + (d.settings.companion === mode ? '.on' : ''), { onclick: () => {
      Store.update(dd => { dd.settings.companion = mode; });
      Chibi.setMode(mode);
    } }, label);
    kids.push(h('section.set', null,
      h('h3', null, '陪伴的小人'),
      h('div.chips', null, pick('A', '粉发骑士'), pick('B', '白发红冠'), pick('both', '两个一起')),
      h('p.muted', null, '点小人会碰杯（只有一个人时是举杯）；完成任务、打卡、番茄结束时也会。点小鸟它会跳一下。')));

    /* ---------- 声音 ---------- */
    kids.push(h('section.set', null,
      h('h3', null, '声音'),
      h('label.switch', null,
        checkBox(d.settings.muted, () => toggleMute(), '静音'),
        ' 静音（碰杯声、番茄钟铃声；画面左上角的小喇叭或按 M 也能切换）'),
      h('p.muted', null, '点一下画面才会开始发声（浏览器的规定）。')));

    /* ---------- 安装 ---------- */
    const installed = matchMedia('(display-mode: standalone)').matches;
    kids.push(h('section.set', null,
      h('h3', null, '安装到电脑'),
      installed ? h('p', null, '已经作为 App 在运行。')
        : this.installEvt ? h('button.btn', { onclick: async () => { this.installEvt.prompt(); await this.installEvt.userChoice; this.installEvt = null; this.refresh(); } }, '安装听雨')
        : h('p.muted', null, '在 Chrome / Edge 地址栏右侧点「安装」图标，就能像普通 App 一样从程序坞 / 开始菜单打开，断网也能用。')));

    /* ---------- 关于 ---------- */
    kids.push(h('section.set', null,
      h('h3', null, '关于'),
      h('p.muted', null, `任务 ${d.tasks.length} 个 · 习惯 ${d.habits.length} 个 · 番茄 ${d.pomos.length} 个 · 倒数日 ${d.countdowns.length} 个`),
      h('p.muted', null, '快捷键：M 静音。点小人碰杯，点小鸟让它跳一下，点底部色板换颜色。')));

    this.el.root.replaceChildren(...kids);
  },
};
