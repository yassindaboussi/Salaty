// src/renderer/js/customDialog.js
const { t } = require('./translations');

/**
 * Show a custom confirmation dialog
 * @param {string} message - The message to display
 * @param {Object} options - Dialog options
 * @param {string} options.confirmText - Text for confirm button (default: "Confirm")
 * @param {string} options.cancelText - Text for cancel button (default: "Cancel")
 * @param {string} options.confirmClass - CSS class for confirm button (default: "btn-primary")
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
 */
function showConfirmDialog(message, options = {}) {
  return new Promise((resolve) => {
    // Default options
    const {
      confirmText = t('confirm') || 'Confirm',
      cancelText = t('cancel') || 'Cancel',
      confirmClass = 'btn-primary'
    } = options;

    // Create dialog overlay
    const overlay = document.createElement('div');
    overlay.className = 'custom-dialog-overlay';

    // Create dialog container
    const dialog = document.createElement('div');
    dialog.className = 'custom-dialog-container';

    // Create dialog content
    dialog.innerHTML = `
      <div class="custom-dialog-icon">
        <i class="fas fa-question-circle"></i>
      </div>
      <div class="custom-dialog-message">${message}</div>
      <div class="custom-dialog-actions">
        <button class="custom-dialog-btn btn-secondary" data-action="cancel">
          ${cancelText}
        </button>
        <button class="custom-dialog-btn ${confirmClass}" data-action="confirm">
          ${confirmText}
        </button>
      </div>
    `;

    overlay.appendChild(dialog);
    // add overlay inside the main app wrapper so theme variables propagate
    const parent = document.getElementById('app') || document.body;
    parent.appendChild(overlay);

    // Animate in
    requestAnimationFrame(() => {
      overlay.classList.add('active');
    });

    // Handle button clicks
    const handleAction = (action) => {
      // Animate out
      overlay.classList.remove('active');

      // Remove from DOM after animation
      setTimeout(() => {
        const parent = document.getElementById('app') || document.body;
        if (parent.contains(overlay)) {
          parent.removeChild(overlay);
        }
      }, 300);

      resolve(action === 'confirm');
    };

    // Add event listeners
    const cancelBtn = dialog.querySelector('[data-action="cancel"]');
    const confirmBtn = dialog.querySelector('[data-action="confirm"]');

    cancelBtn.addEventListener('click', () => handleAction('cancel'));
    confirmBtn.addEventListener('click', () => handleAction('confirm'));

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        handleAction('cancel');
      }
    });

    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        handleAction('cancel');
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  });
}

/**
 * Show a custom alert dialog
 * @param {string} message - The message to display
 * @param {Object} options - Dialog options
 * @param {string} options.okText - Text for OK button (default: "OK")
 * @returns {Promise<void>}
 */
function showAlertDialog(message, options = {}) {
  return new Promise((resolve) => {
    const {
      okText = t('ok') || 'OK'
    } = options;

    // Create dialog overlay
    const overlay = document.createElement('div');
    overlay.className = 'custom-dialog-overlay';

    // Create dialog container
    const dialog = document.createElement('div');
    dialog.className = 'custom-dialog-container';

    // Create dialog content
    dialog.innerHTML = `
      <div class="custom-dialog-icon alert-icon">
        <i class="fas fa-info-circle"></i>
      </div>
      <div class="custom-dialog-message">${message}</div>
      <div class="custom-dialog-actions">
        <button class="custom-dialog-btn btn-primary" data-action="ok">
          ${okText}
        </button>
      </div>
    `;

    overlay.appendChild(dialog);
    const parent = document.getElementById('app') || document.body;
    parent.appendChild(overlay);

    // Animate in
    requestAnimationFrame(() => {
      overlay.classList.add('active');
    });

    // Handle button click
    const handleClose = () => {
      // Animate out
      overlay.classList.remove('active');

      // Remove from DOM after animation
      setTimeout(() => {
        const parent = document.getElementById('app') || document.body;
        if (parent.contains(overlay)) {
          parent.removeChild(overlay);
        }
      }, 300);

      resolve();
    };

    // Add event listener
    const okBtn = dialog.querySelector('[data-action="ok"]');
    okBtn.addEventListener('click', handleClose);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        handleClose();
      }
    });

    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        handleClose();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  });
}

module.exports = {
  showConfirmDialog,
  showAlertDialog
};
