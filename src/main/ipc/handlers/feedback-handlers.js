"use strict";

// IPC for feedback: errors the pages did not catch (renderer/js/core/error-watch.js) go to the
// log file, and the "Send feedback" window (renderer/js/components/feedback-dialog.js) sends a
// problem or a suggestion (app/feedback.js).
const secureIpc = require("../secure-ipc");
const check = require("../validate");
const store = require("../../services/settings-store");
const analytics = require("../../services/analytics-manager");
const { pageName } = require("../../app/crash-handler");
const feedback = require("../../app/feedback");
const log = require("../../services/logger").logger("Page");

const MAX_MESSAGE = 3000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let registered = false;

function registerFeedbackHandlers() {
  if (registered) return;
  registered = true;

  secureIpc.on("renderer-error", (event, info) => {
    if (!check.isPlainObject(info)) return;
    const kind = check.text(info.kind, 40) || "error";
    const message = check.text(info.message, 500) || "(no message)";
    const where = check.text(info.where, 200);
    const page = pageName(event.sender);
    log.error(`${page}: ${kind}: ${message}${where ? ` (${where})` : ""}`);
    analytics.trackError(`renderer_${kind}`, `${page}: ${message}`);
  });

  // what the window shows before sending, and whether it can send at all
  secureIpc.handle("get-feedback-info", () => ({
    details: feedback.technicalDetails(store.get()),
    canSend: feedback.isConfigured(),
    contactEmail: feedback.CONTACT_EMAIL,
  }));

  secureIpc.handle("send-feedback", async (_e, input) => {
    if (!check.isPlainObject(input)) return "failed";
    const type = input.type === "suggestion" ? "suggestion" : "problem";
    const message = check.text(input.message, MAX_MESSAGE);
    if (!message) return "failed";
    const email = check.text(input.email, 200);
    return feedback.sendFeedback(
      {
        type,
        message,
        email: email && EMAIL.test(email) ? email : undefined,
        includeDetails: input.includeDetails === true,
      },
      store.get(),
    );
  });

  // true once after a crash the user chose to report: the home page opens the window
  secureIpc.handle("take-crash-report", () => feedback.takeCrashReport());
}

module.exports = { registerFeedbackHandlers };
