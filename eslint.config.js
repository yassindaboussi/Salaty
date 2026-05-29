'use strict';

const js      = require('@eslint/js');
const globals = require('globals');

module.exports = [
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
    },
  },
];
