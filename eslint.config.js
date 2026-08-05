'use strict';

const js      = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: ['src/renderer/vendor/**', 'src/renderer/js-bundled/**'],
  },
  js.configs.recommended,

  // ── Main process: Node.js only ───────────────────────────────────────────
  {
    files: ['src/main/**/*.js', 'src/preload/**/*.js', 'src/shared/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.commonjs,
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // ── Renderer process: browser + Node (nodeIntegration: true) ────────────
  {
    files: ['src/renderer/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.commonjs,
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  // ── background-player.js: Howler/Howl are loaded globally via a
  //    <script> tag (src/renderer/vendor/howler/howler.min.js), not a
  //    module import — declare them so lint doesn't flag them as undefined.
  {
    files: ['src/renderer/js/media/background-player.js'],
    languageOptions: {
      globals: {
        Howler: 'readonly',
        Howl: 'readonly',
      },
    },
  },
];
