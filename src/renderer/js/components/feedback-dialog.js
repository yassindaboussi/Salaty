"use strict";

// The "Send feedback" window (Settings → About, and at start-up after a crash the user chose to
// report). One choice (a problem or a suggestion), one text box, an optional email for a reply,
// then Send. For a problem, the technical details (app version, system, recent errors, without
// paths or places) are added if the box stays ticked, and can be read first. Sending goes
// through the main process (main/app/feedback.js). Copy is offered only when sending is not
// possible.

const { ipcRenderer } = require("electron");
const { t } = require("../core/i18n");
const { query, queryAll } = require("../core/dom");
const { showToast } = require("../core/toast");
const { html, setHtml } = require("../utils/html");

const MAX_MESSAGE = 2000;

/** @type {Record<string, string>} message key per result */
const RESULT_TEXT = {
  sent: "feedbackSent",
  queued: "feedbackQueued",
  "too-soon": "feedbackTooSoon",
  failed: "feedbackFailed",
};

/** @typedef {"problem" | "suggestion"} FeedbackType */

/**
 * @param {{ type?: FeedbackType, afterCrash?: boolean }} [options]
 */
async function openFeedbackDialog({
  type = "problem",
  afterCrash = false,
} = {}) {
  if (document.querySelector(".feedback-dialog")) return; // already open
  const { details, canSend, contactEmail } =
    await ipcRenderer.invoke("get-feedback-info");
  const previouslyFocused = document.activeElement;

  const overlay = document.createElement("div");
  overlay.className = "custom-dialog-overlay";
  const dialog = document.createElement("div");
  dialog.className = "custom-dialog-container feedback-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "feedbackTitle");

  const choice = (/** @type {FeedbackType} */ value, icon, label) =>
    html`<label class="feedback-dialog__choice">
      <input type="radio" name="feedbackType" value="${value}" ${value === type ? html`checked` : ""} />
      <span><i class="fas ${icon}" aria-hidden="true"></i> ${t(label)}</span>
    </label>`;

  setHtml(
    dialog,
    html`
      <div class="feedback-dialog__form">
       <div class="feedback-dialog__body">
        <div class="custom-dialog-icon"><i class="fas fa-comment-dots" aria-hidden="true"></i></div>
        <h2 class="feedback-dialog__title" id="feedbackTitle">${t("sendFeedback")}</h2>
        <p class="feedback-dialog__intro">${t(afterCrash ? "feedbackAfterCrash" : "feedbackIntro")}</p>
        <fieldset class="feedback-dialog__types">
          <legend class="feedback-dialog__label">${t("feedbackTypeLabel")}</legend>
          <div class="feedback-dialog__choices">
            ${choice("problem", "fa-bug", "feedbackTypeProblem")}
            ${choice("suggestion", "fa-lightbulb", "feedbackTypeSuggestion")}
          </div>
        </fieldset>
        <label class="feedback-dialog__label" for="feedbackMessage" id="feedbackMessageLabel"></label>
        <textarea class="feedback-dialog__input" id="feedbackMessage" rows="3" maxlength="${MAX_MESSAGE}"></textarea>
        <label class="feedback-dialog__label" for="feedbackEmail">${t("feedbackEmail")}</label>
        <input class="feedback-dialog__input" id="feedbackEmail" type="email" maxlength="200"
          autocomplete="email" placeholder="${t("feedbackEmailHint")}" />
        <div class="feedback-dialog__details-box" id="feedbackDetailsBox">
          <label class="feedback-dialog__check">
            <input type="checkbox" id="feedbackDetails" checked />
            <span>${t("feedbackIncludeDetails")}</span>
          </label>
          <details class="feedback-dialog__details">
            <summary>${t("feedbackShowDetails")}</summary>
            <pre dir="ltr">${details}</pre>
          </details>
        </div>
        ${canSend ? "" : html`<p class="feedback-dialog__note">${t("feedbackNoSending")} <bdi>${contactEmail}</bdi></p>`}
        <p class="feedback-dialog__status" id="feedbackStatus" role="status" aria-live="polite"></p>
       </div>
        <div class="custom-dialog-actions feedback-dialog__actions">
          <button type="button" class="custom-dialog-btn btn-secondary" data-action="close">${t("cancel")}</button>
          ${
            canSend
              ? html`<button type="button" class="custom-dialog-btn btn-primary" data-action="send">${t("feedbackSend")}</button>`
              : html`<button type="button" class="custom-dialog-btn btn-primary" data-action="copy">${t("feedbackCopy")}</button>`
          }
        </div>
      </div>
      <div class="feedback-dialog__done" hidden>
        <div class="custom-dialog-icon feedback-dialog__done-icon"><i class="fas fa-circle-check" aria-hidden="true"></i></div>
        <h2 class="feedback-dialog__title">${t("feedbackThanks")}</h2>
        <p class="feedback-dialog__intro" id="feedbackDoneText"></p>
        <div class="custom-dialog-actions">
          <button type="button" class="custom-dialog-btn btn-primary" data-action="close">${t("close")}</button>
        </div>
      </div>
    `,
  );
  overlay.appendChild(dialog);
  (document.getElementById("app") || document.body).appendChild(overlay);

  const messageEl = query("#feedbackMessage", HTMLTextAreaElement, dialog);
  const messageLabel = query("#feedbackMessageLabel", HTMLElement, dialog);
  const emailEl = query("#feedbackEmail", HTMLInputElement, dialog);
  const detailsBox = query("#feedbackDetailsBox", HTMLElement, dialog);
  const detailsCheck = query("#feedbackDetails", HTMLInputElement, dialog);
  const statusEl = query("#feedbackStatus", HTMLElement, dialog);

  const currentType = () =>
    /** @type {FeedbackType} */ (
      query('input[name="feedbackType"]:checked', HTMLInputElement, dialog)
        .value
    );

  // the text box and the technical details follow the choice
  const applyType = () => {
    const isProblem = currentType() === "problem";
    messageLabel.textContent = t(
      isProblem ? "feedbackProblemLabel" : "feedbackSuggestionLabel",
    );
    messageEl.placeholder = t(
      isProblem ? "feedbackProblemHint" : "feedbackSuggestionHint",
    );
    detailsBox.hidden = !isProblem;
  };
  applyType();
  for (const radio of queryAll(
    'input[name="feedbackType"]',
    HTMLInputElement,
    dialog,
  ))
    radio.addEventListener("change", applyType);

  // Show, then focus: the overlay is visibility:hidden until "active", and hidden elements
  // cannot take focus. Reading offsetHeight first applies the hidden state, so the fade-in
  // still plays (no waiting for an animation frame, which a busy window can delay).
  void overlay.offsetHeight;
  overlay.classList.add("active");
  messageEl.focus();

  /** @param {string} text @param {"error" | ""} [kind] */
  const setStatus = (text, kind = "") => {
    statusEl.textContent = text;
    statusEl.dataset.kind = kind;
  };

  const messageText = () => {
    const isProblem = currentType() === "problem";
    const text = `${isProblem ? "Problem" : "Suggestion"}:\n${messageEl.value.trim()}`;
    return isProblem && detailsCheck.checked ? `${text}\n\n${details}` : text;
  };

  const close = () => {
    overlay.classList.remove("active");
    document.removeEventListener("keydown", onKeydown);
    setTimeout(() => overlay.remove(), 300);
    if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
  };

  const showDone = (/** @type {string} */ textKey) => {
    query(".feedback-dialog__form", HTMLElement, dialog).hidden = true;
    const done = query(".feedback-dialog__done", HTMLElement, dialog);
    done.hidden = false;
    query("#feedbackDoneText", HTMLElement, dialog).textContent = t(textKey);
    query('[data-action="close"]', HTMLElement, done).focus();
  };

  const copy = async () => {
    if (!messageEl.value.trim()) {
      setStatus(t("feedbackWriteFirst"), "error");
      messageEl.focus();
      return;
    }
    try {
      await ipcRenderer.invoke("clipboard-write-text", messageText());
      showToast(t("feedbackCopied"), "success");
    } catch {
      setStatus(t("feedbackFailed"), "error");
    }
  };

  const send = async (/** @type {HTMLButtonElement} */ button) => {
    const message = messageEl.value.trim();
    if (!message) {
      setStatus(t("feedbackWriteFirst"), "error");
      messageEl.focus();
      return;
    }
    button.disabled = true;
    setStatus(t("feedbackSending"));
    const result = await ipcRenderer
      .invoke("send-feedback", {
        type: currentType(),
        message,
        email: emailEl.value.trim(),
        includeDetails: detailsCheck.checked,
      })
      .catch(() => "failed");
    if (result === "sent" || result === "queued") {
      showDone(RESULT_TEXT[result]);
      return;
    }
    button.disabled = false;
    setStatus(t(RESULT_TEXT[result] ?? "feedbackFailed"), "error");
    // sending did not work: offer Copy next to Send
    if (!dialog.querySelector('[data-action="copy"]'))
      button.insertAdjacentElement("beforebegin", copyButton());
  };

  const copyButton = () => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "custom-dialog-btn btn-secondary";
    b.dataset.action = "copy";
    b.textContent = t("feedbackCopy");
    return b;
  };

  dialog.addEventListener("click", (e) => {
    const button =
      e.target instanceof Element ? e.target.closest("[data-action]") : null;
    if (!(button instanceof HTMLButtonElement)) return;
    const action = button.dataset.action;
    if (action === "close") close();
    else if (action === "copy") copy();
    else if (action === "send") send(button);
  });

  // Escape closes; Ctrl+Enter sends; Tab stays inside the window
  const onKeydown = (/** @type {KeyboardEvent} */ e) => {
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      const sendBtn = dialog.querySelector('[data-action="send"]');
      if (sendBtn instanceof HTMLButtonElement && !sendBtn.disabled) {
        e.preventDefault();
        send(sendBtn);
      }
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = queryAll(
      "button:not([disabled]), input:not([type=radio]), input[type=radio]:checked, textarea, summary",
      HTMLElement,
      dialog,
    ).filter((el) => !el.closest("[hidden]"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  document.addEventListener("keydown", onKeydown);
}

module.exports = { openFeedbackDialog };
