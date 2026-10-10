"use strict";

// CSS linting for the renderer: `npm run lint:css` (also part of `npm run lint`, so CI checks it).
// Architecture and naming rules are explained at the top of src/renderer/css/app.css.
module.exports = {
  extends: ["stylelint-config-standard"],
  ignoreFiles: ["src/renderer/vendor/**", "src/renderer/js-bundled/**"],
  reportNeedlessDisables: true,
  rules: {
    // Class names: lowercase-with-dashes; shared components may use BEM (block__element--modifier).
    "selector-class-pattern": [
      "^[a-z][a-z0-9]*(-[a-z0-9]+)*(__[a-z0-9]+(-[a-z0-9]+)*)?(--[a-z0-9]+(-[a-z0-9]+)*)?$",
      {
        message: (name) =>
          `"${name}": use lowercase-with-dashes (BEM block__element--modifier is fine)`,
      },
    ],

    // Cascade layers decide which rule wins; !important only for real overrides, with a reason.
    "declaration-no-important": [
      true,
      {
        message:
          "Avoid !important: cascade layers (see css/app.css) decide which rule wins. If it is really needed, add a stylelint-disable comment that says why.",
      },
    ],

    // Arabic: prefer logical properties so one rule works in both directions.
    "property-disallowed-list": [
      ["margin-left", "margin-right", "padding-left", "padding-right"],
      {
        severity: "warning",
        message:
          "Use logical properties (margin-inline-start/-end, padding-inline-start/-end) so the rule also works in RTL",
      },
    ],

    // Theme colours are written rgba(var(--accent-rgb), 0.2) with a comma-separated --accent-rgb
    // ("74, 144, 226"). The modern space syntax would break them, so keep the classic notation.
    "color-function-notation": null,
    "color-function-alias-notation": null,
    "alpha-value-notation": null,

    // Keywords are lowercase, except real font names that keep their capital letters.
    "value-keyword-case": [
      "lower",
      {
        ignoreKeywords: [
          "BlinkMacSystemFont",
          "Tahoma",
          "Geneva",
          "Verdana",
          "Arial",
        ],
      },
    ],

    // Order-based specificity checks are reported (not errors): layers already separate files,
    // and reordering rules just to satisfy this can change which rule wins.
    "no-descending-specificity": [true, { severity: "warning" }],
  },
};
