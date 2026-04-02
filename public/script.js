const CHAT_URL = '/api/chat'; // proxy ke vercel function, api key aman di server
const IMG_URL = 'https://image.pollinations.ai/prompt/';
const MAX_HISTORY = 20;
const HISTORY_KEY = 'glitch_img_history';

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

const SYSTEM_PROMPT = `You are glitch — a helpful AI assistant with a slightly unhinged, gen-Z personality. You're knowledgeable, witty, and occasionally go on unexpected tangents that are actually interesting.

Rules:
1. Always be genuinely helpful first
2. Add personality — dry humor, unexpected observations, the occasional absurd analogy
3. Keep responses concise but interesting. No walls of text unless really needed
4. At the END of every response, suggest 1-2 image prompts relevant to your answer. Format them exactly like this:
   [IMG: detailed image prompt here]
   [IMG: another prompt if relevant]
5. Make image prompts vivid and specific — good for AI image generation
6. Never break character. You're glitch, not a generic assistant.`;

let messages = [{ role: 'system', content: SYSTEM_PROMPT }];

// Theme
const html = document.documentElement;
const themes = ['auto', 'dark', 'light'];
let themeIdx = 0;

themeBtn.addEventListener('click', () => {
  themeIdx = (themeIdx + 1) % themes.length;
  html.dataset.theme = themes[themeIdx];
  themeBtn.textContent = themeIdx === 0 ? '◑' : themeIdx === 1 ? '●' : '○';
});

// Auto-resize textarea
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
});

input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});

sendBtn.addEventListener('click', send);

// History panel
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
  let h = getHistory().filter(i => i.ts !== ts);
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

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function scrollBottom() {
  const wrap = document.getElementById('chatWrap');
  wrap.scrollTop = wrap.scrollHeight;
}

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
  const safeText = escHtml(text).replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  let html_content = safeText;

  if (imgPrompts.length) {
    const btns = imgPrompts.map(p =>
      `<button class="img-prompt-btn" data-prompt="${escHtml(p)}">${escHtml(p)}</button>`
    ).join('');
    html_content += `<div class="img-prompts">${btns}</div>`;
  }

  const div = addMsg('bot', html_content);

  // Attach click handlers
  div.querySelectorAll('.img-prompt-btn').forEach(btn => {
    btn.addEventListener('click', () => generateImage(btn, btn.dataset.prompt));
  });
}

async function generateImage(btn, prompt) {
  if (btn.classList.contains('loading')) return;
  btn.classList.add('loading');
  btn.textContent = 'generating...';

  const encodedPrompt = encodeURIComponent(prompt);
  const imgSrc = `${IMG_URL}${encodedPrompt}?width=768&height=512&model=flux&nologo=true`;

  try {
    // Preload image
    await new Promise((res, rej) => {
      const img = new Image();
      img.onload = res;
      img.onerror = rej;
      img.src = imgSrc;
    });

    // Insert image below the button group
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
    btn.textContent = 'failed, try again';
    btn.classList.remove('loading');
  }
}

async function send() {
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;

  addMsg('user', escHtml(text));
  messages.push({ role: 'user', content: text });

  const typing = addTyping();

  try {
    const res = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelSelect.value,
        messages,
        temperature: 0.85,
        max_tokens: 800
      })
    });

    const data = await res.json();
    typing.remove();

    if (!res.ok) throw new Error(data.error?.message || 'API error');

    const reply = data.choices?.[0]?.message?.content || 'hmm. nothing came out.';
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
