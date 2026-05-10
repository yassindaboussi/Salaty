// src/renderer/js/prayer-widget.js
'use strict';

const { ipcRenderer } = require('electron');

const PRAYER_KEYS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

const PRAYER_ICONS = {
  Fajr:    'fa-cloud-moon',
  Dhuhr:   'fa-sun',
  Asr:     'fa-cloud-sun',
  Maghrib: 'fa-cloud',
  Isha:    'fa-moon'
};

const THEME_CLASSES = [
  'theme-dark','theme-blue','theme-green','theme-brown','theme-gold',
  'theme-pink','theme-purple','theme-emerald','theme-ocean','theme-royal',
  'theme-indigo','theme-classic','theme-navy','theme-ramadan'
];

/* ── State ── */
let settings   = null;
let prayerData = null;
let lang       = 'en';
let tickTimer  = null;
let fetchTimer = null;
let isPinned   = true;

/* ── DOM refs ── */
const appEl        = document.getElementById('app');
const timerEl      = document.getElementById('timerDisplay');
const prayerListEl = document.getElementById('prayerList');
const closeBtnEl   = document.getElementById('closeBtn');
const pinBtnEl     = document.getElementById('pinBtn');

/* ── Utils ── */
function getSecondsFromTime(time) {
  const clean = (time || '').split(' ')[0];
  const [h = 0, m = 0] = clean.split(':').map(Number);
  return h * 3600 + m * 60;
}

function formatCountdown(s) {
  if (s <= 0) return '00:00:00';
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map(n => String(n).padStart(2, '0')).join(':');
}

function nowSeconds() {
  const d = new Date();
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

/* ── Theme ── */
function applyTheme(theme) {
  if (!theme) return;
  appEl.classList.remove(...THEME_CLASSES);
  appEl.classList.add(`theme-${theme}`);
  document.documentElement.dir  = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
}

/* ── Compute ── */
function computePrayers() {
  if (!prayerData?.timings) return null;
  const now = nowSeconds();
  const prayers = PRAYER_KEYS.map(key => {
    const raw = prayerData.timings[key];
    if (!raw) return null;
    const sec = getSecondsFromTime(raw);
    return { key, time: raw.split(' ')[0], sec, wrapped: sec < now ? sec + 86400 : sec };
  }).filter(Boolean).sort((a, b) => a.wrapped - b.wrapped);

  if (!prayers.length) return null;
  const nextIdx    = prayers.findIndex(p => p.wrapped > now);
  const nextPrayer = nextIdx >= 0 ? prayers[nextIdx] : prayers[0];
  const activePrayer = nextIdx > 0 ? prayers[nextIdx - 1] : prayers.at(-1);
  return { prayers, nextPrayer, activePrayer, timeRemaining: nextPrayer.wrapped - now };
}

/* ── Render columns (classes tb-*) ── */
function renderList() {
  const result = computePrayers();
  if (!result) {
    prayerListEl.innerHTML = '<div class="tb-spin"><i class="fas fa-exclamation-circle"></i></div>';
    return;
  }
  const { nextPrayer, activePrayer } = result;
  const ordered = PRAYER_KEYS.map(k => result.prayers.find(p => p.key === k)).filter(Boolean);

  prayerListEl.innerHTML = ordered.map(p => {
    const isActive = p.key === activePrayer.key;
    const isNext   = p.key === nextPrayer.key && !isActive;
    return `<div class="tb-col${isActive ? ' active' : ''}${isNext ? ' next' : ''}">
      <i class="fas ${PRAYER_ICONS[p.key] ?? 'fa-clock'} tb-col-icon"></i>
      <span class="tb-col-time">${p.time}</span>
      <div class="tb-col-dot"></div>
    </div>`;
  }).join('');
}

/* ── Tick ── */
function tick() {
  const result = computePrayers();
  if (!result) return;
  timerEl.textContent = formatCountdown(result.timeRemaining);
  if (result.timeRemaining % 60 === 0) renderList();
}

/* ── Fetch ── */
async function fetchPrayerData() {
  if (!settings?.city || !settings?.country) return;
  try {
    const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(settings.city)}&country=${encodeURIComponent(settings.country)}`;
    const data = await (await fetch(url)).json();
    if (data?.code === 200 && data?.data) {
      prayerData = data.data;
      renderList();
      tick();
    }
  } catch (e) { console.error('[widget]', e); }
}

/* ── Controls ── */
pinBtnEl.addEventListener('click', () => {
  isPinned = !isPinned;
  ipcRenderer.send('widget-set-always-on-top', isPinned);
  pinBtnEl.classList.toggle('pinned', isPinned);
});

closeBtnEl.addEventListener('click', () => {
  appEl.classList.add('closing');
  setTimeout(() => ipcRenderer.send('close-prayer-widget'), 230);
});

/* ── IPC ── */
ipcRenderer.on('theme-changed', (_e, theme) => applyTheme(theme));

/* ── Init ── */
async function init() {
  try {
    settings = await ipcRenderer.invoke('get-settings');
    if (settings) {
      lang = settings.language || 'en';
      applyTheme(settings.theme || 'navy');
    }
    await fetchPrayerData();
    tick();
    tickTimer  = setInterval(tick, 1000);
    fetchTimer = setInterval(fetchPrayerData, 3_600_000);
  } catch (e) { console.error('[widget] init', e); }
}

document.addEventListener('DOMContentLoaded', init);
