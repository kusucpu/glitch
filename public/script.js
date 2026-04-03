const CHAT_URL = '/api/chat';
const IMG_URL = 'https://image.pollinations.ai/prompt/';
const MAX_HISTORY = 20;
const HISTORY_KEY = 'glitck_img_history';
const BYOP_KEY = 'glitck_user_pollen_key';
const FREE_MODELS = ['nova-fast'];
const BYOP_MODELS = [
  'nova-fast', 'qwen-safety', 'gemini-fast', 'mistral', 'qwen-coder',
  'gemini-search', 'perplexity-fast', 'openai-fast', 'openai',
  'qwen-vision', 'minimax', 'deepseek', 'perplexity-reasoning',
  'openai-audio', 'midijourney', 'claude-fast', 'kimi', 'glm', 'qwen-large'
];

const chat = document.getElementById('chat');
const input = document.getElementById('input');
const sendBtn = document.getElementById('sendBtn');
const modelSelect = document.getElementById('modelSelect');
const themeBtn = document.getElementById('themeBtn');
const historyBtn = document.getElementById('historyBtn');
const historyPanel = document.getElementById('historyPanel');
const overlay = document.getElementById('overlay');
const closeHistory = document.getElementById('closeHistory');
const historyContent = document.getElementById('historyContent');
const clearHistory = document.getElementById('clearHistory');
const keyStatus = document.getElementById('keyStatus');
const modalOverlay = document.getElementById('modalOverlay');
const keyInput = document.getElementById('keyInput');
const saveKeyBtn = document.getElementById('saveKeyBtn');
const cancelKeyBtn = document.getElementById('cancelKeyBtn');
const removeKeyBtn = document.getElementById('removeKeyBtn');

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

let messages = [{ role: 'system', content: SYSTEM_PROMPT }];
let pendingModel = null;

// ── BYOP ─────────────────────────────────────────────────────
function getUserKey() {
  return localStorage.getItem(BYOP_KEY) || null;
}

function setUserKey(k) {
  localStorage.setItem(BYOP_KEY, k);
  updateKeyStatus();
}

function removeUserKey() {
  localStorage.removeItem(BYOP_KEY);
  updateKeyStatus();
}

function updateKeyStatus() {
  const k = getUserKey();
  if (k) {
    keyStatus.textContent = '🌸 pollen active';
    keyStatus.classList.add('active');
    keyStatus.title = 'click to manage your pollen key';
  } else {
    keyStatus.classList.remove('active');
  }
}

keyStatus.addEventListener('click', () => openModal(modelSelect.value));

function openModal(model) {
  pendingModel = model;
  const k = getUserKey();
  keyInput.value = k || '';
  removeKeyBtn.style.display = k ? 'block' : 'none';
  modalOverlay.classList.add('show');
  keyInput.focus();
}

function closeModal(revertModel) {
  modalOverlay.classList.remove('show');
  if (revertModel && !getUserKey()) {
    modelSelect.value = FREE_MODELS[0];
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
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(true); });

removeKeyBtn.addEventListener('click', () => {
  removeUserKey();
  keyInput.value = '';
  removeKeyBtn.style.display = 'none';
  modelSelect.value = FREE_MODELS[0];
  closeModal(false);
});

keyInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveKeyBtn.click(); });

modelSelect.addEventListener('change', () => {
  const v = modelSelect.value;
  if (!FREE_MODELS.includes(v) && !getUserKey()) {
    openModal(v);
  }
});

// ── THEME ─────────────────────────────────────────────────────
const html = document.documentElement;
const themes = ['auto', 'dark', 'light'];
let themeIdx = 0;

themeBtn.addEventListener('click', () => {
  themeIdx = (themeIdx + 1) % themes.length;
  html.dataset.theme = themes[themeIdx];
  themeBtn.textContent = themeIdx === 0 ? '◑' : themeIdx === 1 ? '●' : '○';
});

// ── TEXTAREA ──────────────────────────────────────────────────
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
});

input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});

sendBtn.addEventListener('click', send);

// ── HISTORY PANEL ─────────────────────────────────────────────
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

function saveToHistory(prompt, url) {
  let h = getHistory();
  h.unshift({ prompt, url, ts: Date.now() });
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

// ── UTILS ─────────────────────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function scrollBottom() {
  document.getElementById('chatWrap').scrollTop = 99999;
}

// ── CHAT UI ───────────────────────────────────────────────────
function addMsg(role, html_content) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.innerHTML = `
    <div class="avatar">${role === 'user' ? '◉' : '◈'}</div>
    <div class="bubble">${html_content}</div>
  `;
  chat.appendChild(div);
  scrollBottom();
  return div;
}

function addTyping() {
  const div = document.createElement('div');
  div.className = 'msg bot typing';
  div.innerHTML = `
    <div class="avatar">◈</div>
    <div class="bubble"><div class="dot-pulse"><span></span><span></span><span></span></div></div>
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
  const safe = escHtml(text).replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
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

// ── IMAGE GENERATION ──────────────────────────────────────────
async function generateImage(btn, prompt) {
  if (btn.classList.contains('loading')) return;
  btn.classList.add('loading');
  btn.textContent = 'generating...';

  const userKey = getUserKey();
  const imgModel = 'flux';
  const keyParam = userKey ? `&key=${encodeURIComponent(userKey)}` : '';
  const nologo = userKey ? '&nologo=true' : '';
  const imgSrc = `${IMG_URL}${encodeURIComponent(prompt)}?width=768&height=512&model=${imgModel}${nologo}${keyParam}`;

  try {
    await new Promise((res, rej) => {
      const img = new Image();
      img.onload = res;
      img.onerror = rej;
      img.src = imgSrc;
    });

    const imgDiv = document.createElement('div');
    imgDiv.className = 'gen-img';
    imgDiv.innerHTML = `
      <img src="${imgSrc}" alt="${escHtml(prompt)}">
      <div class="img-meta">${escHtml(prompt)}</div>
    `;
    btn.closest('.bubble').appendChild(imgDiv);
    saveToHistory(prompt, imgSrc);
    btn.remove();
    scrollBottom();
  } catch {
    btn.textContent = 'failed — try again';
    btn.classList.remove('loading');
  }
}

// ── SEND MESSAGE ──────────────────────────────────────────────
async function send() {
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;

  addMsg('user', escHtml(text));
  messages.push({ role: 'user', content: text });

  const typing = addTyping();
  const model = modelSelect.value;

  try {
    const res = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        userKey: getUserKey() || undefined
      })
    });

    const data = await res.json();
    typing.remove();

    if (!res.ok) throw new Error(data.detail || data.error || `error ${res.status}`);

    const reply = data.choices?.[0]?.message?.content || 'hmm. nothing.';
    messages.push({ role: 'assistant', content: reply });
    const { text: cleanText, imgPrompts } = parseResponse(reply);
    renderBotMsg(cleanText, imgPrompts);

  } catch (err) {
    typing.remove();
    addMsg('bot', `<span class="error">⚠ ${escHtml(err.message)}</span>`);
  }

  sendBtn.disabled = false;
  input.focus();
}

// ── INIT ──────────────────────────────────────────────────────
updateKeyStatus();
