// ─── Constants ────────────────────────────────────────────────────────────────
const CHAT_URL  = '/api/chat';
const IMG_URL   = '/api/image';
const MAX_HISTORY = 20;
const HISTORY_KEY = 'glitck_img_history';
const BYOP_KEY    = 'glitck_user_pollen_key';

const BYOP_MODELS = [
  'openai-fast', 'openai', 'gemini-fast', 'gemini-search',
  'mistral', 'qwen-coder', 'qwen-large', 'qwen-vision', 'qwen-safety',
  'deepseek', 'minimax', 'kimi', 'glm', 'claude-fast',
  'perplexity-fast', 'perplexity-reasoning', 'midijourney'
];

const SYSTEM_PROMPT = `You are glitck — a helpful AI assistant with a slightly unhinged, gen-Z personality. You're knowledgeable, witty, and occasionally go on unexpected tangents that are actually interesting.

Rules:
1. Always be genuinely helpful first
2. Add personality — dry humor, unexpected observations, the occasional absurd analogy
3. Keep responses concise but interesting. No walls of text unless really needed
4. At the END of every response, suggest 1-2 image prompts relevant to your answer. Format them exactly like this:
   [IMG: detailed image prompt here]
   [IMG: another prompt if relevant]
5. Make image prompts vivid and specific — good for AI image generation
6. Never break character. You're glitck, not a generic assistant.`;

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const chat           = document.getElementById('chat');
const input          = document.getElementById('input');
const sendBtn        = document.getElementById('sendBtn');
const modelSelect    = document.getElementById('modelSelect');
const imgModelSel    = document.getElementById('imgModel');
const imgAspectSel   = document.getElementById('imgAspect');
const themeBtn       = document.getElementById('themeBtn');
const historyBtn     = document.getElementById('historyBtn');
const historyPanel   = document.getElementById('historyPanel');
const overlay        = document.getElementById('overlay');
const closeHistory   = document.getElementById('closeHistory');
const historyContent = document.getElementById('historyContent');
const clearHistory   = document.getElementById('clearHistory');
const keyStatus      = document.getElementById('keyStatus');
const modalOverlay   = document.getElementById('modalOverlay');
const keyInput       = document.getElementById('keyInput');
const saveKeyBtn     = document.getElementById('saveKeyBtn');
const cancelKeyBtn   = document.getElementById('cancelKeyBtn');
const removeKeyBtn   = document.getElementById('removeKeyBtn');

// ─── State ────────────────────────────────────────────────────────────────────
let messages     = [{ role: 'system', content: SYSTEM_PROMPT }];
let pendingModel = null;

// ─── Key helpers ──────────────────────────────────────────────────────────────
const getUserKey    = () => localStorage.getItem(BYOP_KEY) || null;
const setUserKey    = (k) => { localStorage.setItem(BYOP_KEY, k); updateKeyStatus(); };
const removeUserKey = () => { localStorage.removeItem(BYOP_KEY); updateKeyStatus(); };

function updateKeyStatus() {
  const k = getUserKey();
  if (k) {
    keyStatus.textContent = '🌸 pollen active';
    keyStatus.classList.add('active');
    keyStatus.title = 'click to manage your pollen key';
  } else {
    keyStatus.classList.remove('active');
  }
  updateModelOptions();
}

function updateModelOptions() {
  const hasKey = !!getUserKey();
  Array.from(modelSelect.options).forEach(opt => {
    if (BYOP_MODELS.includes(opt.value)) {
      opt.disabled = !hasKey;
      // Add visual indicator
      if (!hasKey && !opt.dataset.origText) {
        opt.dataset.origText = opt.text;
        opt.text = opt.text + ' 🔒';
      } else if (hasKey && opt.dataset.origText) {
        opt.text = opt.dataset.origText;
        delete opt.dataset.origText;
      }
    }
  });
  if (!hasKey && BYOP_MODELS.includes(modelSelect.value)) {
    modelSelect.value = 'nova-fast';
  }
}

// ─── BYOP Modal ───────────────────────────────────────────────────────────────
keyStatus.addEventListener('click', () => openModal());

function openModal(revertTo) {
  pendingModel = revertTo || null;
  const k = getUserKey();
  keyInput.value = k || '';
  removeKeyBtn.style.display = k ? 'block' : 'none';
  modalOverlay.classList.add('show');
  keyInput.focus();
}

function closeModal(revert) {
  modalOverlay.classList.remove('show');
  if (revert && pendingModel) {
    modelSelect.value = pendingModel;
  }
  pendingModel = null;
}

saveKeyBtn.addEventListener('click', () => {
  const k = keyInput.value.trim();
  if (!k) { keyInput.focus(); return; }
  setUserKey(k);
  closeModal(false);
});

cancelKeyBtn.addEventListener('click', () => closeModal(true));
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeModal(true);
});

removeKeyBtn.addEventListener('click', () => {
  removeUserKey();
  keyInput.value = '';
  removeKeyBtn.style.display = 'none';
  closeModal(false);
});

keyInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') saveKeyBtn.click();
});

modelSelect.addEventListener('change', () => {
  const v    = modelSelect.value;
  const prev = modelSelect.dataset.prev || 'nova-fast';
  if (BYOP_MODELS.includes(v) && !getUserKey()) {
    openModal(prev); // will revert to prev if cancelled
    return;
  }
  modelSelect.dataset.prev = v;
});

modelSelect.addEventListener('mousedown', () => {
  modelSelect.dataset.prev = modelSelect.value;
});

// ─── Theme ────────────────────────────────────────────────────────────────────
const html   = document.documentElement;
const themes = ['auto', 'dark', 'light'];
let themeIdx = 0;

themeBtn.addEventListener('click', () => {
  themeIdx = (themeIdx + 1) % themes.length;
  html.dataset.theme  = themes[themeIdx];
  themeBtn.textContent = themeIdx === 0 ? '◑' : themeIdx === 1 ? '●' : '○';
});

// ─── Textarea auto-resize ─────────────────────────────────────────────────────
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
});
input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});
sendBtn.addEventListener('click', send);

// ─── History panel ────────────────────────────────────────────────────────────
historyBtn.addEventListener('click', () => {
  historyPanel.classList.add('open');
  overlay.classList.add('show');
  renderHistory();
});

[closeHistory, overlay].forEach(el => el.addEventListener('click', closePanel));
function closePanel() {
  historyPanel.classList.remove('open');
  overlay.classList.remove('show');
}

clearHistory.addEventListener('click', () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
});

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}

function saveToHistory(prompt, url, model, aspect) {
  let h = getHistory();
  h.unshift({ prompt, url, model, aspect, ts: Date.now() });
  if (h.length > MAX_HISTORY) h = h.slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}

function deleteFromHistory(ts) {
  const h = getHistory().filter(i => i.ts !== ts);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  renderHistory();
}

function renderHistory() {
  const h = getHistory();
  if (!h.length) {
    historyContent.innerHTML = '<p class="empty-history">no images yet.<br>generate something first.</p>';
    return;
  }
  historyContent.innerHTML = h.map(item => `
    <div class="history-item">
      <img src="${item.url}" alt="${escHtml(item.prompt)}" loading="lazy">
      <div class="h-meta">
        <span>${escHtml(item.prompt.slice(0, 40))}${item.prompt.length > 40 ? '…' : ''}</span>
        <button class="h-delete" onclick="deleteFromHistory(${item.ts})">✕</button>
      </div>
    </div>
  `).join('');
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function scrollBottom() {
  document.getElementById('chatWrap').scrollTop = 99999;
}

// ─── Chat UI ──────────────────────────────────────────────────────────────────
function addMsg(role, htmlContent) {
  const div       = document.createElement('div');
  div.className   = `msg ${role}`;
  div.innerHTML   = `
    <div class="avatar">${role === 'user' ? '◉' : '◈'}</div>
    <div class="bubble">${htmlContent}</div>
  `;
  chat.appendChild(div);
  scrollBottom();
  return div;
}

function addTyping() {
  const div     = document.createElement('div');
  div.className = 'msg bot typing';
  div.innerHTML = `
    <div class="avatar">◈</div>
    <div class="bubble">
      <div class="dot-pulse"><span></span><span></span><span></span></div>
    </div>
  `;
  chat.appendChild(div);
  scrollBottom();
  return div;
}

function parseResponse(text) {
  const imgPrompts = [];
  const cleaned = text.replace(/\[IMG:\s*(.*?)\]/g, (_, p) => {
    imgPrompts.push(p.trim());
    return '';
  }).trim();
  return { text: cleaned, imgPrompts };
}

function renderBotMsg(text, imgPrompts) {
  const safe = escHtml(text)
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  let content = safe;
  if (imgPrompts.length) {
    const btns = imgPrompts.map(p =>
      `<button class="img-prompt-btn" data-prompt="${escHtml(p)}">${escHtml(p)}</button>`
    ).join('');
    content += `<div class="img-prompts">${btns}</div>`;
  }

  const div = addMsg('bot', content);
  div.querySelectorAll('.img-prompt-btn').forEach(btn => {
    btn.addEventListener('click', () => generateImage(btn, btn.dataset.prompt));
  });
}

// ─── Image generation ─────────────────────────────────────────────────────────
async function generateImage(btn, prompt) {
  if (btn.classList.contains('loading')) return;

  // Use current image UI settings
  const model  = imgModelSel.value;
  const aspect = imgAspectSel.value;

  btn.classList.add('loading');
  btn.textContent = 'generating…';

  try {
    const userKey = getUserKey();
    const body    = { prompt, model, aspect };
    if (userKey) body.userKey = userKey;

    const res = await fetch(IMG_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const blob   = await res.blob();
    const objUrl = URL.createObjectURL(blob);

    const imgDiv = document.createElement('div');
    imgDiv.className = 'gen-img';
    imgDiv.innerHTML = `
      <img src="${objUrl}" alt="${escHtml(prompt)}">
      <div class="img-meta">
        <span>${escHtml(prompt.slice(0, 60))}${prompt.length > 60 ? '…' : ''}</span>
        <span class="img-meta-tag">${model} · ${aspect}</span>
      </div>
    `;
    btn.closest('.bubble').appendChild(imgDiv);

    saveToHistory(prompt, objUrl, model, aspect);
    btn.remove();
    scrollBottom();

  } catch (err) {
    btn.textContent = `⚠ failed — ${escHtml(err.message)}`;
    btn.classList.remove('loading');
  }
}

// ─── Send message ─────────────────────────────────────────────────────────────
async function send() {
  const text = input.value.trim();
  if (!text || sendBtn.disabled) return;

  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;

  addMsg('user', escHtml(text));
  messages.push({ role: 'user', content: text });

  const model   = modelSelect.value;
  const typing  = addTyping();

  try {
    const userKey = getUserKey();
    const body    = { model, messages };
    if (userKey) body.userKey = userKey;

    const res = await fetch(CHAT_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });

    const data = await res.json();
    typing.remove();

    if (!res.ok) {
      if (res.status === 403) {
        addMsg('bot', `<span class="error">⚠ this model needs your own pollen key. <button onclick="openModal()" style="background:none;border:none;color:var(--accent2);cursor:pointer;font-family:var(--font);font-size:13px;text-decoration:underline;padding:0">add key ↗</button></span>`);
      } else {
        throw new Error(data.detail || data.error || `error ${res.status}`);
      }
      messages.pop();

    } else {
      const reply = data.choices?.[0]?.message?.content || 'hmm. nothing.';
      messages.push({ role: 'assistant', content: reply });
      const { text: cleanText, imgPrompts } = parseResponse(reply);
      renderBotMsg(cleanText, imgPrompts);
    }

  } catch (err) {
    typing.remove();
    if (messages[messages.length - 1]?.role === 'user') messages.pop();
    addMsg('bot', `<span class="error">⚠ ${escHtml(err.message || 'something broke')}</span>`);
  }

  sendBtn.disabled = false;
  input.focus();
}

// ─── Init ─────────────────────────────────────────────────────────────────────
updateKeyStatus();
