"use strict";

(function () {
  const { setLanguage, whenReady } = require("../../js/core/i18n/translations");
  const { initTooltipSystem } = require("../../js/core/tooltipSystem");
  const { ipcRenderer } = require("electron");

  Promise.all([ipcRenderer.invoke("get-settings"), whenReady()])
    .then(([settings]) => {
      if (settings?.language) setLanguage(settings.language);
      initTooltipSystem();
    })
    .catch(() => initTooltipSystem());
})();
