/**
 * analytics-uuid.js
 * Lightweight UUID v4 generator — no external dependencies.
 * Uses Node.js built-in crypto module.
 */

'use strict';

const { randomBytes } = require('crypto');

function v4() {
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant RFC 4122
  const h = b.toString('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

module.exports = { v4 };
