// tasbihUI.js
const { ipcRenderer } = require('electron');
const { t, getLanguage } = require('./translations');
const screenSizeManager = require('./screenSize');
const analytics = require('./utils/analytics');

const DEFAULT_DHIKR_LIST = [
  { name: 'سُبْحَانَ اللَّهِ', count: 33, translation: 'SubhanAllah (Glory be to Allah)' },
  { name: 'الْحَمْدُ لِلَّهِ', count: 33, translation: 'Alhamdulillah (Praise be to Allah)' },
  { name: 'اللَّهُ أَكْبَرُ', count: 34, translation: 'Allahu Akbar (Allah is the Greatest)' },
  { name: 'لا إله إلا الله', count: 100, translation: 'La ilaha illallah (There is no god but Allah)' },
  { name: 'أستغفر الله', count: 100, translation: 'Astaghfirullah (I seek forgiveness from Allah)' },
  { name: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', count: 100, translation: 'SubhanAllahi wa bihamdihi' }
];

const FOOTER_TEXTS = {
  en: [
    '"So remember Me; I will remember you" [Quran 2:152]',
    '"And the remembering of Allah is greater" [Quran 29:45]',
    '"Glory and praise be to Allah, by whose grace good deeds are accomplished"',
    '"Whoever remembers his Lord and glorifies Him, his sins fall away"',
    '"The best of deeds is to remember Allah"'
  ],
  fr: [
    '"Souvenez-vous de Moi, donc, Je Me souviendrai de vous" [Coran 2:152]',
    '"Et le rappel d\'Allah est plus grand" [Coran 29:45]',
    '"Gloire et louange à Allah, par la grâce duquel les bonnes actions sont accomplies"',
    '"Celui qui se souvient de son Seigneur et Le glorifie, ses péchés tombent"',
    '"La meilleure des actions est le rappel d\'Allah"'
  ],
  ar: [
    '"فَاذْكُرُونِي أَذْكُرْكُمْ" [البقرة 152]',
    '"وَلَذِكْرُ اللَّهِ أَكْبَرُ" [العنكبوت 45]',
    '"سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ"',
    '"مَنْ ذَكَرَ رَبَّهُ وَسَبَّحَهُ تَسَاقَطَتْ خَطَايَاهُ"',
    '"أَفْضَلُ الْأَعْمَالِ ذِكْرُ اللَّهِ"'
  ]
};

let currentDhikr = {
  name: DEFAULT_DHIKR_LIST[0].name,
  count: DEFAULT_DHIKR_LIST[0].count,
  current: 0
};
let tasbihHistory = {};

function initTasbihPage() {
  console.log('Initializing Tasbih page...');

  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      const size = screenSizeManager.getWindowSize();
      ipcRenderer.invoke('resize-window', size.width, size.height);
      ipcRenderer.invoke('navigate-to', 'features');
    });
  }

  document.getElementById('resetAllBtn')?.addEventListener('click', showResetAllConfirm);
  document.getElementById('incrementBtn')?.addEventListener('click', incrementCount);
  document.getElementById('resetBtn')?.addEventListener('click', resetCurrentDhikr);

  loadTasbihState();
  updateTasbihUI();
  populateDhikrGrid();
  updateCounterDisplay();
  addSpacebarIndicator();
  setupKeyboardListener();

  console.log('initTasbihPage completed');
}

function addSpacebarIndicator() {
  const container = document.querySelector('.tasbih-counter-container');
  if (!container || container.querySelector('.spacebar-indicator')) return;
  const lang = getLanguage();
  const spaceText = lang === 'ar' ? 'مسافة' : (lang === 'fr' ? 'Espace' : 'Space');
  const indicator = document.createElement('div');
  indicator.className = 'spacebar-indicator';
  indicator.innerHTML = `<i class="fas fa-keyboard"></i><kbd>␣</kbd><span>${spaceText}</span>`;
  container.appendChild(indicator);
}

function setupKeyboardListener() {
  document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !event.target.matches('input, textarea, button')) {
      event.preventDefault();
      const display = document.querySelector('.tasbih-counter-display');
      if (display) {
        display.style.transform = 'scale(0.95)';
        setTimeout(() => { display.style.transform = 'scale(1)'; }, 100);
      }
      incrementCount();
    }
  });
}

function updateTasbihUI() {
  const lang = getLanguage();
  const tasbihTitle    = document.getElementById('tasbihTitle');
  const tasbihFooter   = document.getElementById('tasbihFooterText');
  const incrementLabel = document.getElementById('incrementLabel');
  const resetLabel     = document.getElementById('resetLabel');
  const dhikrLabel     = document.getElementById('dhikrLabel');
  const targetLabel    = document.getElementById('targetLabel');
  const resetAllBtn    = document.getElementById('resetAllBtn');

  if (tasbihTitle)    tasbihTitle.textContent    = t('tasbih');
  if (tasbihFooter) {
    const texts = FOOTER_TEXTS[lang] || FOOTER_TEXTS.en;
    tasbihFooter.textContent = texts[Math.floor(Math.random() * texts.length)];
  }
  if (incrementLabel) incrementLabel.textContent = lang === 'ar' ? 'تسبيح' : (lang === 'fr' ? 'Compter'          : 'Count');
  if (resetLabel)     resetLabel.textContent     = lang === 'ar' ? 'إعادة' : (lang === 'fr' ? 'Réinitialiser'    : 'Reset');
  if (dhikrLabel)     dhikrLabel.textContent     = lang === 'ar' ? 'اختر الذكر' : (lang === 'fr' ? 'Choisir Dhikr' : 'Select Dhikr');
  if (targetLabel)    targetLabel.textContent    = '/ ' + currentDhikr.count;
  if (resetAllBtn)    resetAllBtn.setAttribute('aria-label', t('resetAll'));
}

function loadTasbihState() {
  try {
    const saved = localStorage.getItem('tasbihState');
    if (saved) {
      tasbihHistory = JSON.parse(saved);
      const lastDhikr = localStorage.getItem('lastDhikr');
      if (lastDhikr) {
        const parsed = JSON.parse(lastDhikr);
        currentDhikr = {
          name: parsed.name || DEFAULT_DHIKR_LIST[0].name,
          count: parsed.count || DEFAULT_DHIKR_LIST[0].count,
          current: tasbihHistory[parsed.name] || 0
        };
      } else {
        currentDhikr.current = tasbihHistory[currentDhikr.name] || 0;
      }
    }
  } catch (err) {
    console.error('Error loading tasbih state:', err);
    tasbihHistory = {};
  }
}

function saveTasbihState() {
  try {
    tasbihHistory[currentDhikr.name] = currentDhikr.current;
    localStorage.setItem('tasbihState', JSON.stringify(tasbihHistory));
    localStorage.setItem('lastDhikr', JSON.stringify({ name: currentDhikr.name, count: currentDhikr.count }));
  } catch (err) {
    console.error('Error saving tasbih state:', err);
  }
}

function populateDhikrGrid() {
  const grid = document.getElementById('dhikrGrid');
  if (!grid) return;
  grid.innerHTML = '';
  DEFAULT_DHIKR_LIST.forEach((dhikr, index) => {
    const card = document.createElement('div');
    card.className = 'dhikr-card';
    if (dhikr.name === currentDhikr.name) card.classList.add('active');
    card.dataset.index = index;
    card.dataset.name  = dhikr.name;
    card.dataset.count = dhikr.count;

    const nameSpan  = document.createElement('span');
    nameSpan.className   = 'dhikr-name';
    nameSpan.textContent = dhikr.name;
    const countSpan = document.createElement('span');
    countSpan.className   = 'dhikr-count';
    countSpan.textContent = dhikr.count;

    card.appendChild(nameSpan);
    card.appendChild(countSpan);
    card.addEventListener('click', () => switchDhikr(dhikr.name, dhikr.count));
    grid.appendChild(card);
  });
}

function switchDhikr(name, count) {
  if (currentDhikr.name === name) return;
  tasbihHistory[currentDhikr.name] = currentDhikr.current;
  currentDhikr = { name, count, current: tasbihHistory[name] || 0 };

  document.querySelectorAll('.dhikr-card').forEach(card => {
    card.classList.toggle('active', card.dataset.name === name);
  });

  updateCounterDisplay();
  saveTasbihState();

  const lang = getLanguage();
  const msg = lang === 'ar' ? `تم التبديل إلى ${name}` : (lang === 'fr' ? `Passé à ${name}` : `Switched to ${name}`);
  showSuccessToast(msg);
}

function incrementCount() {
  if (currentDhikr.current >= currentDhikr.count) return;

  currentDhikr.current++;
  tasbihHistory[currentDhikr.name] = currentDhikr.current;
  updateCounterDisplay();
  saveTasbihState();

  // ── Track tap ─────────────────────────────────────────────────────────────
  analytics.tasbihTap(currentDhikr.name, currentDhikr.current, currentDhikr.count); // ← ANALYTICS

  if (currentDhikr.current === currentDhikr.count) {
    const lang = getLanguage();
    const msg = lang === 'ar' ? `أكملت! ${currentDhikr.count} تسبيحة`
              : lang === 'fr' ? `Complété! ${currentDhikr.count} fois`
              :                 `Completed! ${currentDhikr.count} times`;
    showSuccessToast(msg, false, 3000);

    // ── Track completion ──────────────────────────────────────────────────
    analytics.tasbihCompleted(currentDhikr.name); // ← ANALYTICS

    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  } else {
    if (navigator.vibrate) navigator.vibrate(50);
  }
}

function resetCurrentDhikr() {
  if (currentDhikr.current === 0) return;
  showResetConfirm(() => {
    currentDhikr.current = 0;
    tasbihHistory[currentDhikr.name] = 0;
    updateCounterDisplay();
    saveTasbihState();
    const lang = getLanguage();
    const msg = lang === 'ar' ? 'تم إعادة العداد' : (lang === 'fr' ? 'Compteur réinitialisé' : 'Counter reset');
    showSuccessToast(msg);
  });
}

function resetAllCounters() {
  DEFAULT_DHIKR_LIST.forEach(d => { tasbihHistory[d.name] = 0; });
  currentDhikr.current = 0;
  saveTasbihState();
  updateCounterDisplay();
  const lang = getLanguage();
  const msg = lang === 'ar' ? 'تم إعادة جميع العدادات' : (lang === 'fr' ? 'Tous les compteurs réinitialisés' : 'All counters reset');
  showSuccessToast(msg);
}

function showResetConfirm(callback) {
  const lang = getLanguage();
  const titles   = { en: 'Reset Counter', fr: 'Réinitialiser le compteur', ar: 'إعادة العداد' };
  const messages = { en: 'Are you sure you want to reset this counter?', fr: 'Êtes-vous sûr de vouloir réinitialiser ce compteur ?', ar: 'هل أنت متأكد أنك تريد إعادة هذا العداد؟' };
  const cancels  = { en: 'Cancel', fr: 'Annuler', ar: 'إلغاء' };
  const resets   = { en: 'Reset', fr: 'Réinitialiser', ar: 'إعادة' };
  const dialog   = document.createElement('div');
  dialog.className = 'tasbih-confirm-dialog';
  dialog.innerHTML = `<div class="tasbih-confirm-box">
    <div class="tasbih-confirm-title">${titles[lang] || titles.en}</div>
    <div class="tasbih-confirm-message">${messages[lang] || messages.en}</div>
    <div class="tasbih-confirm-buttons">
      <button class="tasbih-confirm-btn tasbih-confirm-cancel">${cancels[lang] || cancels.en}</button>
      <button class="tasbih-confirm-btn tasbih-confirm-reset">${resets[lang] || resets.en}</button>
    </div></div>`;
  document.body.appendChild(dialog);
  dialog.querySelector('.tasbih-confirm-cancel').addEventListener('click', () => dialog.remove());
  dialog.querySelector('.tasbih-confirm-reset').addEventListener('click', () => { if (callback) callback(); dialog.remove(); });
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.remove(); });
}

function showResetAllConfirm() {
  const lang = getLanguage();
  const titles   = { en: 'Reset All Counters', fr: 'Réinitialiser tous les compteurs', ar: 'إعادة جميع العدادات' };
  const messages = { en: 'Are you sure? This cannot be undone.', fr: 'Êtes-vous sûr ? Cette action ne peut pas être annulée.', ar: 'هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.' };
  const cancels  = { en: 'Cancel', fr: 'Annuler', ar: 'إلغاء' };
  const resets   = { en: 'Reset All', fr: 'Tout réinitialiser', ar: 'إعادة الكل' };
  const dialog   = document.createElement('div');
  dialog.className = 'tasbih-confirm-dialog';
  dialog.innerHTML = `<div class="tasbih-confirm-box">
    <div class="tasbih-confirm-title">${titles[lang] || titles.en}</div>
    <div class="tasbih-confirm-message">${messages[lang] || messages.en}</div>
    <div class="tasbih-confirm-buttons">
      <button class="tasbih-confirm-btn tasbih-confirm-cancel">${cancels[lang] || cancels.en}</button>
      <button class="tasbih-confirm-btn tasbih-confirm-reset">${resets[lang] || resets.en}</button>
    </div></div>`;
  document.body.appendChild(dialog);
  dialog.querySelector('.tasbih-confirm-cancel').addEventListener('click', () => dialog.remove());
  dialog.querySelector('.tasbih-confirm-reset').addEventListener('click', () => { resetAllCounters(); dialog.remove(); });
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.remove(); });
}

function updateCounterDisplay() {
  const cv = document.getElementById('counterValue');
  const tv = document.getElementById('targetValue');
  const tl = document.getElementById('targetLabel');
  if (cv) cv.textContent = currentDhikr.current;
  if (tv) tv.textContent = currentDhikr.count;
  if (tl) tl.textContent = `/ ${currentDhikr.count}`;
}

function showSuccessToast(message, isError = false, duration = 2000) {
  document.querySelectorAll('.success-toast').forEach(t => t.remove());
  const toast = document.createElement('div');
  toast.className = `success-toast ${isError ? 'error' : ''}`;
  toast.innerHTML = `<i class="fas fa-${isError ? 'exclamation-circle' : 'check-circle'}"></i><span>${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 200); }, duration);
}

module.exports = { initTasbihPage };