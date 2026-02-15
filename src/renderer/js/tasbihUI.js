// tasbihUI.js
const { ipcRenderer } = require('electron');
const { t, getLanguage } = require('./translations');
const screenSizeManager = require('./screenSize');

// Default dhikr options
const DEFAULT_DHIKR_LIST = [
  { name: 'سُبْحَانَ اللَّهِ', count: 33, translation: 'SubhanAllah (Glory be to Allah)' },
  { name: 'الْحَمْدُ لِلَّهِ', count: 33, translation: 'Alhamdulillah (Praise be to Allah)' },
  { name: 'اللَّهُ أَكْبَرُ', count: 34, translation: 'Allahu Akbar (Allah is the Greatest)' },
  { name: 'لا إله إلا الله', count: 100, translation: 'La ilaha illallah (There is no god but Allah)' },
  { name: 'أستغفر الله', count: 100, translation: 'Astaghfirullah (I seek forgiveness from Allah)' },
  { name: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', count: 100, translation: 'SubhanAllahi wa bihamdihi (Glory be to Allah and praise Him)' }
];

// Language-specific footer texts
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

// ==================== TASBIH PAGE FUNCTIONS ====================
function initTasbihPage() {
  console.log('Initializing Tasbih page...');

  // Setup back button
  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      const currentSize = screenSizeManager.getWindowSize();
      ipcRenderer.invoke('resize-window', currentSize.width, currentSize.height);
      ipcRenderer.invoke('navigate-to', 'features');
    });
  }

  // Setup reset all button
  const resetAllBtn = document.getElementById('resetAllBtn');
  if (resetAllBtn) {
    resetAllBtn.addEventListener('click', showResetAllConfirm);
  }

  // Setup increment and reset buttons
  const incrementBtn = document.getElementById('incrementBtn');
  const resetBtn = document.getElementById('resetBtn');

  if (incrementBtn) {
    incrementBtn.addEventListener('click', incrementCount);
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', resetCurrentDhikr);
  }

  // Load saved state
  loadTasbihState();

  // Update UI text
  updateTasbihUI();

  // Populate dhikr grid
  populateDhikrGrid();

  // Update counter display
  updateCounterDisplay();

  // Add spacebar indicator to counter container
  addSpacebarIndicator();

  // Setup keyboard listener for spacebar
  setupKeyboardListener();

  console.log('initTasbihPage completed');
}

function addSpacebarIndicator() {
  const counterContainer = document.querySelector('.tasbih-counter-container');
  if (!counterContainer) return;
  
  // Check if indicator already exists
  if (counterContainer.querySelector('.spacebar-indicator')) return;
  
  const indicator = document.createElement('div');
  indicator.className = 'spacebar-indicator';
  
  const lang = getLanguage();
  const spaceText = lang === 'ar' ? 'مسافة' : (lang === 'fr' ? 'Espace' : 'Space');
  
  indicator.innerHTML = `
    <i class="fas fa-keyboard"></i>
    <kbd>␣</kbd>
    <span>${spaceText}</span>
  `;
  
  counterContainer.appendChild(indicator);
}

function setupKeyboardListener() {
  document.addEventListener('keydown', (event) => {
    // Check if spacebar was pressed and not in an input field
    if (event.code === 'Space' && !event.target.matches('input, textarea, button')) {
      event.preventDefault(); // Prevent page scroll
      
      // Add visual feedback to counter
      const counterDisplay = document.querySelector('.tasbih-counter-display');
      if (counterDisplay) {
        counterDisplay.style.transform = 'scale(0.95)';
        setTimeout(() => {
          counterDisplay.style.transform = 'scale(1)';
        }, 100);
      }
      
      incrementCount();
    }
  });
}

function updateTasbihUI() {
  const tasbihTitle = document.getElementById('tasbihTitle');
  const tasbihFooterText = document.getElementById('tasbihFooterText');
  const incrementLabel = document.getElementById('incrementLabel');
  const resetLabel = document.getElementById('resetLabel');
  const dhikrLabel = document.getElementById('dhikrLabel');
  const targetLabel = document.getElementById('targetLabel');
  const resetAllBtn = document.getElementById('resetAllBtn');

  const lang = getLanguage();

  if (tasbihTitle) tasbihTitle.textContent = t('tasbih');
  
  // Random footer text based on language
  if (tasbihFooterText) {
    const footerTexts = FOOTER_TEXTS[lang] || FOOTER_TEXTS.en;
    const randomIndex = Math.floor(Math.random() * footerTexts.length);
    tasbihFooterText.textContent = footerTexts[randomIndex];
  }
  
  if (incrementLabel) incrementLabel.textContent = lang === 'ar' ? 'تسبيح' : (lang === 'fr' ? 'Compter' : 'Count');
  if (resetLabel) resetLabel.textContent = lang === 'ar' ? 'إعادة' : (lang === 'fr' ? 'Réinitialiser' : 'Reset');
  if (dhikrLabel) dhikrLabel.textContent = lang === 'ar' ? 'اختر الذكر' : (lang === 'fr' ? 'Choisir Dhikr' : 'Select Dhikr');
  if (targetLabel) targetLabel.textContent = '/ ' + currentDhikr.count;
  
  if (resetAllBtn) {
    resetAllBtn.setAttribute('aria-label', t('resetAll'));
  }
}

function loadTasbihState() {
  try {
    const savedState = localStorage.getItem('tasbihState');
    if (savedState) {
      tasbihHistory = JSON.parse(savedState);
      
      // Try to restore last used dhikr
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
  } catch (error) {
    console.error('Error loading tasbih state:', error);
    tasbihHistory = {};
  }
}

function saveTasbihState() {
  try {
    // Save current count to history
    tasbihHistory[currentDhikr.name] = currentDhikr.current;
    localStorage.setItem('tasbihState', JSON.stringify(tasbihHistory));
    
    // Save last used dhikr
    localStorage.setItem('lastDhikr', JSON.stringify({
      name: currentDhikr.name,
      count: currentDhikr.count
    }));
  } catch (error) {
    console.error('Error saving tasbih state:', error);
  }
}

function populateDhikrGrid() {
  const dhikrGrid = document.getElementById('dhikrGrid');
  if (!dhikrGrid) return;

  dhikrGrid.innerHTML = '';

  DEFAULT_DHIKR_LIST.forEach((dhikr, index) => {
    const card = document.createElement('div');
    card.className = 'dhikr-card';
    if (dhikr.name === currentDhikr.name) {
      card.classList.add('active');
    }
    card.dataset.index = index;
    card.dataset.name = dhikr.name;
    card.dataset.count = dhikr.count;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'dhikr-name';
    nameSpan.textContent = dhikr.name;

    const countSpan = document.createElement('span');
    countSpan.className = 'dhikr-count';
    countSpan.textContent = dhikr.count;

    card.appendChild(nameSpan);
    card.appendChild(countSpan);

    card.addEventListener('click', () => {
      switchDhikr(dhikr.name, dhikr.count);
    });

    dhikrGrid.appendChild(card);
  });
}

function switchDhikr(name, count) {
  if (currentDhikr.name === name) return;

  // Save current count before switching
  tasbihHistory[currentDhikr.name] = currentDhikr.current;

  // Switch to new dhikr
  currentDhikr = {
    name: name,
    count: count,
    current: tasbihHistory[name] || 0
  };

  // Update active state in grid
  document.querySelectorAll('.dhikr-card').forEach(card => {
    if (card.dataset.name === name) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });

  // Update displays
  updateCounterDisplay();
  saveTasbihState();

  const lang = getLanguage();
  const message = lang === 'ar' ? `تم التبديل إلى ${name}` : (lang === 'fr' ? `Passé à ${name}` : `Switched to ${name}`);
  showSuccessToast(message);
}

function incrementCount() {
  if (currentDhikr.current < currentDhikr.count) {
    currentDhikr.current++;
    
    // Save to history
    tasbihHistory[currentDhikr.name] = currentDhikr.current;
    
    // Update displays
    updateCounterDisplay();
    saveTasbihState();

    // Check if completed
    if (currentDhikr.current === currentDhikr.count) {
      const lang = getLanguage();
      const message = lang === 'ar' ? `أكملت! ${currentDhikr.count} تسبيحة` : 
                     (lang === 'fr' ? `Complété! ${currentDhikr.count} fois` : 
                     `Completed! ${currentDhikr.count} times`);
      showSuccessToast(message, false, 3000);
      
      // Vibrate if supported (for mobile feel)
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    } else {
      // Light haptic feedback simulation
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }
  }
}

function resetCurrentDhikr() {
  if (currentDhikr.current === 0) return;

  // Show confirm dialog with language support
  showResetConfirm(() => {
    currentDhikr.current = 0;
    tasbihHistory[currentDhikr.name] = 0;
    
    updateCounterDisplay();
    saveTasbihState();
    
    const lang = getLanguage();
    const message = lang === 'ar' ? 'تم إعادة العداد' : (lang === 'fr' ? 'Compteur réinitialisé' : 'Counter reset');
    showSuccessToast(message);
  });
}

function resetAllCounters() {
  // Reset all dhikr counts
  DEFAULT_DHIKR_LIST.forEach(dhikr => {
    tasbihHistory[dhikr.name] = 0;
  });
  
  // Reset current dhikr
  currentDhikr.current = 0;
  
  // Save and update
  saveTasbihState();
  updateCounterDisplay();
  
  const lang = getLanguage();
  const message = lang === 'ar' ? 'تم إعادة جميع العدادات' : (lang === 'fr' ? 'Tous les compteurs réinitialisés' : 'All counters reset');
  showSuccessToast(message);
}

function showResetConfirm(callback) {
  const lang = getLanguage();
  
  const titles = {
    en: 'Reset Counter',
    fr: 'Réinitialiser le compteur',
    ar: 'إعادة العداد'
  };
  
  const messages = {
    en: 'Are you sure you want to reset this counter?',
    fr: 'Êtes-vous sûr de vouloir réinitialiser ce compteur ?',
    ar: 'هل أنت متأكد أنك تريد إعادة هذا العداد؟'
  };
  
  const cancelTexts = {
    en: 'Cancel',
    fr: 'Annuler',
    ar: 'إلغاء'
  };
  
  const resetTexts = {
    en: 'Reset',
    fr: 'Réinitialiser',
    ar: 'إعادة'
  };
  
  const dialog = document.createElement('div');
  dialog.className = 'tasbih-confirm-dialog';
  dialog.innerHTML = `
    <div class="tasbih-confirm-box">
      <div class="tasbih-confirm-title">${titles[lang] || titles.en}</div>
      <div class="tasbih-confirm-message">${messages[lang] || messages.en}</div>
      <div class="tasbih-confirm-buttons">
        <button class="tasbih-confirm-btn tasbih-confirm-cancel">${cancelTexts[lang] || cancelTexts.en}</button>
        <button class="tasbih-confirm-btn tasbih-confirm-reset">${resetTexts[lang] || resetTexts.en}</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const cancelBtn = dialog.querySelector('.tasbih-confirm-cancel');
  const resetBtn = dialog.querySelector('.tasbih-confirm-reset');

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      dialog.remove();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (callback) callback();
      dialog.remove();
    });
  }

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      dialog.remove();
    }
  });
}

function showResetAllConfirm() {
  const lang = getLanguage();
  
  const titles = {
    en: 'Reset All Counters',
    fr: 'Réinitialiser tous les compteurs',
    ar: 'إعادة جميع العدادات'
  };
  
  const messages = {
    en: 'Are you sure you want to reset all tasbih counters? This action cannot be undone.',
    fr: 'Êtes-vous sûr de vouloir réinitialiser tous les compteurs ? Cette action ne peut pas être annulée.',
    ar: 'هل أنت متأكد أنك تريد إعادة جميع العدادات؟ لا يمكن التراجع عن هذا الإجراء.'
  };
  
  const cancelTexts = {
    en: 'Cancel',
    fr: 'Annuler',
    ar: 'إلغاء'
  };
  
  const resetTexts = {
    en: 'Reset All',
    fr: 'Tout réinitialiser',
    ar: 'إعادة الكل'
  };
  
  const dialog = document.createElement('div');
  dialog.className = 'tasbih-confirm-dialog';
  dialog.innerHTML = `
    <div class="tasbih-confirm-box">
      <div class="tasbih-confirm-title">${titles[lang] || titles.en}</div>
      <div class="tasbih-confirm-message">${messages[lang] || messages.en}</div>
      <div class="tasbih-confirm-buttons">
        <button class="tasbih-confirm-btn tasbih-confirm-cancel">${cancelTexts[lang] || cancelTexts.en}</button>
        <button class="tasbih-confirm-btn tasbih-confirm-reset">${resetTexts[lang] || resetTexts.en}</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const cancelBtn = dialog.querySelector('.tasbih-confirm-cancel');
  const resetBtn = dialog.querySelector('.tasbih-confirm-reset');

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      dialog.remove();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetAllCounters();
      dialog.remove();
    });
  }

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      dialog.remove();
    }
  });
}

function updateCounterDisplay() {
  const counterValue = document.getElementById('counterValue');
  const targetValue = document.getElementById('targetValue');
  const targetLabel = document.getElementById('targetLabel');

  if (counterValue) {
    counterValue.textContent = currentDhikr.current;
  }
  
  if (targetValue) {
    targetValue.textContent = currentDhikr.count;
  }
  
  if (targetLabel) {
    targetLabel.textContent = `/ ${currentDhikr.count}`;
  }
}

function showSuccessToast(message, isError = false, duration = 2000) {
  // Remove existing toasts
  document.querySelectorAll('.success-toast').forEach(toast => toast.remove());

  const toast = document.createElement('div');
  toast.className = `success-toast ${isError ? 'error' : ''}`;
  toast.innerHTML = `
    <i class="fas fa-${isError ? 'exclamation-circle' : 'check-circle'}"></i>
    <span>${message}</span>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

module.exports = { initTasbihPage };