/* ===========================================================
   Scenario Editor — ノベルゲーム向けシナリオ作成ツール
   データはブラウザの localStorage に自動保存されます。
   =========================================================== */

const STORAGE_KEY = 'scenario-editor:project';
const uid = (p) => p + '_' + Math.random().toString(36).slice(2, 9);

const KINDS = {
  say:       { label: 'セリフ',   btn: '＋ セリフ' },
  narration: { label: '地の文',   btn: '＋ 地の文' },
  choice:    { label: '選択肢',   btn: '＋ 選択肢' },
  jump:      { label: 'ジャンプ', btn: '＋ ジャンプ' },
  note:      { label: 'メモ',     btn: '＋ メモ' },
};

const PALETTE = ['#6ea8ff','#ffb86e','#5ed6a4','#ff6e78','#b57edc','#ffd866','#78dce8','#ff9ecd'];

/* ---------- state ---------- */
let project = null;
let currentSceneId = null;

function blankProject() {
  const scene = newScene('オープニング');
  return { title: '無題のシナリオ', characters: [], scenes: [scene], startSceneId: scene.id };
}
function newScene(title) {
  return { id: uid('sc'), title: title || '新しいシーン', bg: '', lines: [] };
}
function newLine(kind) {
  const l = { id: uid('ln'), kind };
  if (kind === 'say')       Object.assign(l, { charId: '', text: '' });
  if (kind === 'narration') Object.assign(l, { text: '' });
  if (kind === 'note')      Object.assign(l, { text: '' });
  if (kind === 'choice')    Object.assign(l, { options: [{ text: '選択肢1', next: '' }, { text: '選択肢2', next: '' }] });
  if (kind === 'jump')      Object.assign(l, { next: '' });
  return l;
}

/* ---------- persistence ---------- */
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  $('saveState').textContent = '保存中…';
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      $('saveState').textContent = '保存済 ' + new Date().toLocaleTimeString('ja-JP');
    } catch {
      $('saveState').textContent = '保存失敗';
    }
  }, 300);
}
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch { /* 壊れていたら破棄 */ }
  return null;
}
function migrate(p) {
  if (!p || !Array.isArray(p.scenes) || !p.scenes.length) return null;
  p.characters = p.characters || [];
  p.title = p.title || '無題のシナリオ';
  p.scenes.forEach(s => { s.lines = s.lines || []; s.bg = s.bg || ''; });
  if (!p.scenes.some(s => s.id === p.startSceneId)) p.startSceneId = p.scenes[0].id;
  return p;
}

/* ---------- helpers ---------- */
const $ = (id) => document.getElementById(id);
const scene = (id) => project.scenes.find(s => s.id === id);
const cur = () => scene(currentSceneId);
const charOf = (id) => project.characters.find(c => c.id === id);
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(t._h); t._h = setTimeout(() => t.hidden = true, 1800);
}
function sceneOptions(selectedId, placeholder) {
  const sel = el('select');
  sel.appendChild(new Option(placeholder || '(次のシーンへ)', ''));
  project.scenes.forEach(s => sel.appendChild(new Option(s.title, s.id)));
  sel.value = project.scenes.some(s => s.id === selectedId) ? selectedId : '';
  return sel;
}

/* ---------- render ---------- */
function renderAll() {
  $('projectTitle').value = project.title;
  renderScenes();
  renderChars();
  renderEditor();
  renderFlow();
  renderStats();
}

function renderScenes() {
  const ul = $('sceneList'); ul.innerHTML = '';
  project.scenes.forEach(s => {
    const li = el('li', s.id === currentSceneId ? 'active' : '');
    if (s.id === project.startSceneId) li.appendChild(el('span', '', '▶'));
    li.appendChild(el('span', 'nm', s.title));
    li.appendChild(el('span', 'cnt', String(s.lines.length)));
    li.onclick = () => { currentSceneId = s.id; renderAll(); };
    ul.appendChild(li);
  });
}

function renderChars() {
  const ul = $('charList'); ul.innerHTML = '';
  if (!project.characters.length) ul.appendChild(el('li', 'stats', 'まだいません'));
  project.characters.forEach(c => {
    const li = el('li');
    const dot = el('span', 'dot'); dot.style.background = c.color;
    const name = el('span', 'nm', c.name);
    const del = el('button', 'mini danger', '✕');
    del.onclick = (e) => {
      e.stopPropagation();
      if (!confirm(`「${c.name}」を削除しますか？（セリフの話者は空欄になります）`)) return;
      project.characters = project.characters.filter(x => x.id !== c.id);
      project.scenes.forEach(s => s.lines.forEach(l => { if (l.charId === c.id) l.charId = ''; }));
      save(); renderAll();
    };
    li.append(dot, name, del);
    li.onclick = () => editChar(c);
    ul.appendChild(li);
  });
}

function editChar(c) {
  const name = prompt('キャラクター名', c.name);
  if (name === null) return;
  c.name = name.trim() || c.name;
  const color = prompt('色（#rrggbb）', c.color);
  if (color) c.color = color.trim();
  save(); renderAll();
}

function renderEditor() {
  const s = cur();
  const head = $('sceneHeader'); head.innerHTML = '';
  const lines = $('lines'); lines.innerHTML = '';
  const bar = $('addBar'); bar.innerHTML = '';
  if (!s) { lines.appendChild(el('div', 'empty', 'シーンを選択してください')); return; }

  /* --- シーン見出し --- */
  const title = el('input', 'stitle'); title.value = s.title;
  title.oninput = () => { s.title = title.value; save(); renderScenes(); renderFlow(); };

  const row = el('div', 'row');
  const bgField = el('div', 'field');
  bgField.appendChild(el('label', '', '背景画像 URL（任意）'));
  const bg = el('input'); bg.value = s.bg; bg.placeholder = 'https://… または空欄';
  bg.oninput = () => { s.bg = bg.value; save(); };
  bgField.appendChild(bg);

  const startBtn = el('button', '', s.id === project.startSceneId ? '★ 開始シーン' : '☆ 開始シーンにする');
  startBtn.onclick = () => { project.startSceneId = s.id; save(); renderAll(); };

  const delBtn = el('button', 'danger', '🗑 シーン削除');
  delBtn.onclick = () => {
    if (project.scenes.length === 1) return toast('最後のシーンは削除できません');
    if (!confirm(`シーン「${s.title}」を削除しますか？`)) return;
    project.scenes = project.scenes.filter(x => x.id !== s.id);
    project.scenes.forEach(sc => sc.lines.forEach(l => {
      if (l.next === s.id) l.next = '';
      (l.options || []).forEach(o => { if (o.next === s.id) o.next = ''; });
    }));
    if (project.startSceneId === s.id) project.startSceneId = project.scenes[0].id;
    currentSceneId = project.scenes[0].id;
    save(); renderAll();
  };

  row.append(bgField, startBtn, delBtn);
  head.append(title, row);

  /* --- 行 --- */
  if (!s.lines.length) lines.appendChild(el('div', 'empty', '下のボタンから行を追加しましょう'));
  s.lines.forEach((l, i) => lines.appendChild(renderLine(s, l, i)));

  /* --- 追加ボタン --- */
  Object.entries(KINDS).forEach(([kind, def]) => {
    const b = el('button', kind === 'say' ? 'primary' : '', def.btn);
    b.onclick = () => {
      s.lines.push(newLine(kind));
      save(); renderEditor(); renderFlow(); renderStats(); renderScenes();
      lines.lastElementChild?.querySelector('textarea,input,select')?.focus();
    };
    bar.appendChild(b);
  });
}

function renderLine(s, l, i) {
  const wrap = el('div', 'line k-' + l.kind);
  wrap.appendChild(el('div', 'kind', KINDS[l.kind].label));
  const body = el('div', 'body');

  if (l.kind === 'say') {
    const r = el('div', 'speaker-row');
    const sel = el('select');
    sel.appendChild(new Option('(話者なし)', ''));
    project.characters.forEach(c => sel.appendChild(new Option(c.name, c.id)));
    sel.value = l.charId || '';
    const dot = el('span', 'dot');
    dot.style.background = charOf(l.charId)?.color || 'transparent';
    sel.onchange = () => {
      l.charId = sel.value;
      dot.style.background = charOf(l.charId)?.color || 'transparent';
      save();
    };
    r.append(dot, sel);
    body.appendChild(r);
    body.appendChild(textArea(l, 'text', 'セリフを入力…'));
  }
  else if (l.kind === 'narration') body.appendChild(textArea(l, 'text', '地の文…'));
  else if (l.kind === 'note')      body.appendChild(textArea(l, 'text', '制作メモ（プレビューには出ません）', 'note'));
  else if (l.kind === 'jump') {
    const sel = sceneOptions(l.next, '(選択してください)');
    sel.onchange = () => { l.next = sel.value; save(); renderFlow(); };
    body.appendChild(sel);
  }
  else if (l.kind === 'choice') {
    l.options.forEach((o, oi) => {
      const r = el('div', 'choice-row');
      const t = el('input'); t.value = o.text; t.placeholder = '選択肢のテキスト';
      t.oninput = () => { o.text = t.value; save(); renderFlow(); };
      const sel = sceneOptions(o.next, '(次のシーンへ)');
      sel.onchange = () => { o.next = sel.value; save(); renderFlow(); };
      const del = el('button', 'mini danger', '✕');
      del.onclick = () => {
        if (l.options.length <= 1) return toast('選択肢は1つ以上必要です');
        l.options.splice(oi, 1); save(); renderEditor(); renderFlow();
      };
      r.append(t, sel, del);
      body.appendChild(r);
    });
    const add = el('button', 'mini', '＋ 選択肢を追加');
    add.onclick = () => { l.options.push({ text: '', next: '' }); save(); renderEditor(); };
    body.appendChild(add);
  }

  const tools = el('div', 'tools');
  const up = el('button', '', '↑'), down = el('button', '', '↓'), del = el('button', 'danger', '✕');
  up.disabled = i === 0; down.disabled = i === s.lines.length - 1;
  up.onclick   = () => { s.lines.splice(i - 1, 0, s.lines.splice(i, 1)[0]); save(); renderEditor(); };
  down.onclick = () => { s.lines.splice(i + 1, 0, s.lines.splice(i, 1)[0]); save(); renderEditor(); };
  del.onclick  = () => { s.lines.splice(i, 1); save(); renderEditor(); renderFlow(); renderStats(); renderScenes(); };
  tools.append(up, down, del);

  wrap.append(body, tools);
  return wrap;
}

function textArea(obj, key, placeholder, cls) {
  const ta = el('textarea', cls);
  ta.value = obj[key] || '';
  ta.placeholder = placeholder;
  ta.oninput = () => { obj[key] = ta.value; save(); renderStats(); };
  return ta;
}

/* ---------- フロー図 ---------- */
function renderFlow() {
  const box = $('flow'); box.innerHTML = '';
  project.scenes.forEach((s, idx) => {
    const n = el('div', 'flow-node' + (s.id === currentSceneId ? ' active' : ''));
    n.appendChild(el('div', 't', (s.id === project.startSceneId ? '▶ ' : '') + s.title));
    n.appendChild(el('div', 'm', `${s.lines.length} 行 / ${countChars(s)} 文字`));
    n.onclick = () => { currentSceneId = s.id; renderAll(); };
    box.appendChild(n);

    const targets = [];
    s.lines.forEach(l => {
      if (l.kind === 'jump') targets.push([l.next, '→ ジャンプ']);
      if (l.kind === 'choice') l.options.forEach(o => targets.push([o.next, '→ ' + (o.text || '(無題)')]));
    });
    if (!targets.length && idx < project.scenes.length - 1) {
      targets.push([project.scenes[idx + 1].id, '↓ 次のシーンへ']);
    }
    targets.forEach(([id, label]) => {
      const t = scene(id);
      const e = el('div', 'flow-edge' + (id && !t ? ' bad' : ''),
        `${label}: ${t ? t.title : (id ? '(不明)' : '未設定 → 終了')}`);
      box.appendChild(e);
    });
  });
}

function countChars(s) {
  return s.lines.reduce((a, l) => a + (l.kind === 'note' ? 0 : (l.text || '').length), 0);
}
function renderStats() {
  const scenes = project.scenes.length;
  const lines = project.scenes.reduce((a, s) => a + s.lines.length, 0);
  const chars = project.scenes.reduce((a, s) => a + countChars(s), 0);
  const branches = project.scenes.reduce((a, s) => a + s.lines.filter(l => l.kind === 'choice').length, 0);
  $('stats').innerHTML =
    `シーン <b>${scenes}</b><br>行数 <b>${lines}</b><br>文字数 <b>${chars}</b><br>分岐 <b>${branches}</b><br>` +
    `登場人物 <b>${project.characters.length}</b>`;
}

/* ---------- プレビュー ---------- */
const pv = { sceneId: null, index: 0, waiting: false };

function startPreview() {
  pv.sceneId = project.startSceneId; pv.index = 0; pv.waiting = false;
  $('preview').hidden = false;
  stepShow();
}
function endPreview() { $('preview').hidden = true; }

function stepShow() {
  const s = scene(pv.sceneId);
  $('pvChoices').innerHTML = '';
  if (!s) return finish('シーンが見つかりません');
  $('pvBg').style.backgroundImage = s.bg ? `url("${s.bg.replace(/"/g, '%22')}")` : '';

  // メモは飛ばす
  while (pv.index < s.lines.length && s.lines[pv.index].kind === 'note') pv.index++;

  if (pv.index >= s.lines.length) {
    const i = project.scenes.indexOf(s);
    const nx = project.scenes[i + 1];
    if (nx) { pv.sceneId = nx.id; pv.index = 0; return stepShow(); }
    return finish('― 完 ―');
  }

  const l = s.lines[pv.index];
  if (l.kind === 'say') {
    const c = charOf(l.charId);
    setText(c ? c.name : '', l.text, c ? c.color : '#fff');
  } else if (l.kind === 'narration') {
    setText('', l.text, '#fff');
  } else if (l.kind === 'jump') {
    if (!l.next) return finish('― 完 ―');
    pv.sceneId = l.next; pv.index = 0; return stepShow();
  } else if (l.kind === 'choice') {
    setText('', '', '#fff');
    pv.waiting = true;
    $('pvHint').textContent = '選択してください';
    l.options.forEach(o => {
      const b = el('button', '', o.text || '(無題)');
      b.onclick = (e) => {
        e.stopPropagation();
        pv.waiting = false;
        $('pvHint').textContent = 'クリック / スペースで進む';
        if (o.next) { pv.sceneId = o.next; pv.index = 0; }
        else { pv.index++; }
        stepShow();
      };
      $('pvChoices').appendChild(b);
    });
    return;
  }
  pv.index++;
}
function setText(name, text, color) {
  $('pvName').textContent = name;
  $('pvName').style.color = color;
  $('pvText').textContent = text;
}
function finish(msg) {
  setText('', msg, '#fff');
  pv.waiting = true;
  $('pvHint').textContent = '閉じるボタンで終了';
}

/* ---------- 入出力 ---------- */
function exportJSON() {
  download(JSON.stringify(project, null, 2), safeName(project.title) + '.json', 'application/json');
}
function exportTxt() {
  const out = [`# ${project.title}`, ''];
  project.scenes.forEach(s => {
    out.push(`## ${s.title}${s.id === project.startSceneId ? '  [開始]' : ''}`);
    if (s.bg) out.push(`(背景: ${s.bg})`);
    s.lines.forEach(l => {
      if (l.kind === 'say') out.push(`${charOf(l.charId)?.name || '???'}「${l.text}」`);
      else if (l.kind === 'narration') out.push(`　${l.text}`);
      else if (l.kind === 'note') out.push(`// ${l.text}`);
      else if (l.kind === 'jump') out.push(`=> ${scene(l.next)?.title || '終了'}`);
      else if (l.kind === 'choice')
        l.options.forEach(o => out.push(`  ◆ ${o.text} => ${scene(o.next)?.title || '(そのまま)'}`));
    });
    out.push('');
  });
  download(out.join('\n'), safeName(project.title) + '.txt', 'text/plain');
}
const safeName = (s) => (s || 'scenario').replace(/[\\/:*?"<>|]/g, '_');
function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type: type + ';charset=utf-8' }));
  const a = el('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(filename + ' を書き出しました');
}

/* ---------- サンプル ---------- */
function sampleProject() {
  const a = { id: uid('ch'), name: '結衣', color: '#ff9ecd' };
  const b = { id: uid('ch'), name: '先輩', color: '#78dce8' };
  const s1 = newScene('放課後の教室');
  const s2 = newScene('屋上ルート');
  const s3 = newScene('図書室ルート');
  s1.lines = [
    Object.assign(newLine('narration'), { text: '夕暮れの教室。窓の外では、部活動の掛け声が遠く響いている。' }),
    Object.assign(newLine('say'), { charId: a.id, text: '……あれ、先輩。まだ残ってたんですね。' }),
    Object.assign(newLine('say'), { charId: b.id, text: 'ん。ちょっと考え事してた。……そっちこそ。' }),
    Object.assign(newLine('choice'), { options: [
      { text: '屋上に誘う', next: s2.id },
      { text: '図書室に行こうと言う', next: s3.id },
    ]}),
  ];
  s2.lines = [
    Object.assign(newLine('narration'), { text: '風が強い。フェンス越しの空が、やけに広く見えた。' }),
    Object.assign(newLine('say'), { charId: b.id, text: 'こんなとこ連れてきて、なに話すつもり？' }),
    Object.assign(newLine('jump'), { next: '' }),
  ];
  s3.lines = [
    Object.assign(newLine('narration'), { text: '紙とインクの匂い。司書のいないカウンターに、夕日が落ちている。' }),
    Object.assign(newLine('say'), { charId: a.id, text: '静かなところの方が、話しやすいかなって。' }),
    Object.assign(newLine('note'), { text: 'ここから共通ルートに合流させる予定' }),
    Object.assign(newLine('jump'), { next: '' }),
  ];
  return { title: 'サンプル：放課後の分岐', characters: [a, b], scenes: [s1, s2, s3], startSceneId: s1.id };
}

/* ---------- イベント ---------- */
function bind() {
  $('projectTitle').oninput = (e) => { project.title = e.target.value; save(); };

  $('btnAddScene').onclick = () => {
    const s = newScene('シーン ' + (project.scenes.length + 1));
    project.scenes.push(s); currentSceneId = s.id; save(); renderAll();
  };
  $('btnAddChar').onclick = () => {
    const name = prompt('キャラクター名');
    if (!name || !name.trim()) return;
    project.characters.push({
      id: uid('ch'), name: name.trim(),
      color: PALETTE[project.characters.length % PALETTE.length],
    });
    save(); renderAll();
  };

  // ファイルメニュー
  const menu = $('fileMenu');
  $('btnFile').onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; };
  document.addEventListener('click', () => menu.hidden = true);
  menu.onclick = (e) => {
    const act = e.target.dataset?.act;
    if (!act) return;
    menu.hidden = true;
    if (act === 'new') {
      if (!confirm('現在の内容を破棄して新規作成しますか？')) return;
      project = blankProject(); currentSceneId = project.scenes[0].id; save(); renderAll();
    }
    if (act === 'export') exportJSON();
    if (act === 'exportTxt') exportTxt();
    if (act === 'import') $('fileInput').click();
    if (act === 'sample') {
      if (!confirm('現在の内容を破棄してサンプルを読み込みますか？')) return;
      project = sampleProject(); currentSceneId = project.startSceneId; save(); renderAll();
    }
  };

  $('fileInput').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const p = migrate(safeParse(r.result));
      if (!p) return toast('読み込めませんでした（形式が不正です）');
      project = p; currentSceneId = project.startSceneId;
      save(); renderAll(); toast('読み込みました');
    };
    r.readAsText(f);
    e.target.value = '';
  };

  // プレビュー
  $('btnPreview').onclick = startPreview;
  $('pvClose').onclick = (e) => { e.stopPropagation(); endPreview(); };
  $('pvStage').onclick = () => { if (!pv.waiting) stepShow(); };
  document.addEventListener('keydown', (e) => {
    if ($('preview').hidden) return;
    if (e.key === 'Escape') endPreview();
    if ((e.key === ' ' || e.key === 'Enter') && !pv.waiting) { e.preventDefault(); stepShow(); }
  });
}

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

/* ---------- init ---------- */
project = load() || blankProject();
currentSceneId = project.startSceneId;
bind();
renderAll();
$('saveState').textContent = '準備完了';
