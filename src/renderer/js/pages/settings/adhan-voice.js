"use strict";

// Settings → Notifications → Adhan voice: the voices (shared/adhan-voices.js) as a list, each
// with ▶ to listen and, for the recordings from Wikimedia Commons, a link to the source and its
// licence; "Your own file" (copied in by main: services/adhan-voices.js); Fajr's own voice.
const { ipcRenderer } = require("electron");
const TomSelect = require("tom-select").default;
const { t } = require("../../core/i18n");
const { state } = require("../../core/store");
const { byId } = require("../../core/dom");
const { showToast } = require("../../core/toast");
const { refreshTooltips } = require("../../core/tooltips");
const { html, setHtml } = require("../../utils/html");
const {
  ADHAN_VOICES,
  DEFAULT_ADHAN_VOICE,
  CUSTOM_ADHAN_VOICE,
  FAJR_SAME_VOICE,
  isAdhanVoice,
} = require("../../../../shared/adhan-voices");
const { persistSettings } = require("./persist");
const {
  togglePreview,
  onPreviewChange,
  previewing,
  stopPreview,
  canPlay,
} = require("./adhan-preview");
const { showConfirmDialog } = require("../../components/confirm-dialog");

/** @type {InstanceType<typeof TomSelect> | null} */
let fajrPicker = null;

const hasCustom = () => Boolean(state.settings.adhanCustomName);
const chosen = () =>
  isAdhanVoice(state.settings.adhanVoice) &&
  (state.settings.adhanVoice !== CUSTOM_ADHAN_VOICE || hasCustom())
    ? state.settings.adhanVoice
    : DEFAULT_ADHAN_VOICE;

/** @param {string} id */
const voiceName = (id) => t(`adhanVoice_${id}`);

/** "3:09" */
function length(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** The ▶ / ■ button of a row. */
function playButton(id) {
  return html`<button type="button" class="adhan-voice-btn adhan-voice-play" data-play="${id}"
      aria-pressed="false" aria-label="${t("adhanListen").replace("{voice}", voiceName(id))}"
      data-tip="${t("adhanListen").replace("{voice}", voiceName(id))}">
      <i class="fas fa-play" aria-hidden="true"></i>
    </button>`;
}

/**
 * ⓘ: the recording's page on Wikimedia Commons; its tooltip names the licence.
 * @param {import("../../../../shared/adhan-voices").AdhanVoice} v
 */
function licenceButton(v) {
  const licence =
    v.licence === "Public domain" ? t("adhanPublicDomain") : (v.licence ?? "");
  const label = t("adhanSource").replace("{licence}", licence);
  return html`<button type="button" class="adhan-voice-btn adhan-voice-licence" data-source="${v.source}"
    aria-label="${label}" data-tip="${label}">
    <i class="fas fa-circle-info" aria-hidden="true"></i>
  </button>`;
}

function renderList() {
  const current = chosen();
  // the voices as tiles: name, mosque or reciter and length, then ⓘ and ▶
  const rows = ADHAN_VOICES.map(
    (
      v,
    ) => html`<li class="adhan-voice is-tile${v.id === current ? " is-chosen" : ""}">
      <label class="adhan-voice-pick">
        <input type="radio" name="adhanVoice" value="${v.id}" ${v.id === current ? html`checked` : ""} />
        <span class="adhan-voice-text">
          <span class="adhan-voice-name">${voiceName(v.id)}</span>
          <span class="adhan-voice-by">${t(`adhanVoiceBy_${v.id}`)}</span>
          <span class="adhan-voice-length">${length(v.seconds)}</span>
        </span>
      </label>
      <div class="adhan-voice-foot">
        ${v.source ? licenceButton(v) : ""}
        ${playButton(v.id)}
      </div>
    </li>`,
  );
  const custom = CUSTOM_ADHAN_VOICE;
  // "Your own file" is the last tile: its file name (cut with "…", whole in the tooltip), and
  // 🗑 📂 ▶ once a file is chosen
  const name = String(state.settings.adhanCustomName ?? "");
  const customRow = html`<li class="adhan-voice is-tile${current === custom ? " is-chosen" : ""}">
      <label class="adhan-voice-pick">
        <input type="radio" name="adhanVoice" value="${custom}" ${current === custom ? html`checked` : ""} />
        <span class="adhan-voice-text">
          <span class="adhan-voice-name">${voiceName(custom)}</span>
          <span class="adhan-voice-by is-file" dir="auto" title="${name}">${name || t("adhanCustomNone")}</span>
        </span>
      </label>
      <div class="adhan-voice-foot">
        ${
          hasCustom()
            ? html`<button type="button" class="adhan-voice-btn" data-action="remove"
              aria-label="${t("adhanCustomRemove")}" data-tip="${t("adhanCustomRemove")}">
              <i class="fas fa-trash" aria-hidden="true"></i>
            </button>`
            : ""
        }
        <button type="button" class="adhan-voice-btn" data-action="choose"
          aria-label="${t("adhanCustomChoose")}" data-tip="${t("adhanCustomChoose")}">
          <i class="fas fa-folder-open" aria-hidden="true"></i>
        </button>
        ${hasCustom() ? playButton(custom) : ""}
      </div>
    </li>`;
  const list = byId("adhanVoiceList", HTMLElement);
  setHtml(list, html`${rows}${customRow}`);
  syncPlayButtons(previewing());
  refreshTooltips();
}

function renderFajr() {
  const options = [
    { value: FAJR_SAME_VOICE, text: t("adhanFajrSame") },
    ...ADHAN_VOICES.map((v) => ({ value: v.id, text: voiceName(v.id) })),
    ...(hasCustom()
      ? [{ value: CUSTOM_ADHAN_VOICE, text: voiceName(CUSTOM_ADHAN_VOICE) }]
      : []),
  ];
  const saved = state.settings.adhanVoiceFajr ?? FAJR_SAME_VOICE;
  const current = options.some((o) => o.value === saved)
    ? saved
    : FAJR_SAME_VOICE;
  if (!fajrPicker) {
    fajrPicker = new TomSelect("#adhanFajrInput", {
      options,
      items: [current],
      controlInput: null, // a short list: no typing
      dropdownClass: "ts-dropdown calc-dropdown fajr-dropdown",
      sortField: [{ field: "$order" }],
    });
    // last on the page: open the list upward when there is no room for it below
    fajrPicker.on("dropdown_open", (/** @type {HTMLElement} */ dropdown) =>
      openUpIfNeeded(fajrPicker?.wrapper, dropdown),
    );
    fajrPicker.on("change", (/** @type {string} */ value) => {
      if (!value) return fajrPicker?.setValue(current, true);
      state.settings.adhanVoiceFajr = value;
      persistSettings();
    });
    return;
  }
  fajrPicker.clearOptions();
  fajrPicker.addOptions(options);
  fajrPicker.setValue(current, true);
}

/**
 * Opens a picker's list above its box when it would be cut below: by the scrolling settings
 * pane or the window, whichever ends first.
 * @param {HTMLElement | undefined} wrapper
 * @param {HTMLElement} dropdown
 */
function openUpIfNeeded(wrapper, dropdown) {
  if (!wrapper) return;
  wrapper.classList.remove("is-dropup");
  const box = wrapper.getBoundingClientRect();
  let bottom = window.innerHeight;
  let top = 0;
  for (let el = wrapper.parentElement; el; el = el.parentElement) {
    const overflow = getComputedStyle(el).overflowY;
    if (overflow === "auto" || overflow === "scroll") {
      const area = el.getBoundingClientRect();
      bottom = Math.min(bottom, area.bottom);
      top = Math.max(top, area.top);
      break;
    }
  }
  const needed = dropdown.offsetHeight + 8;
  if (bottom - box.bottom < needed && box.top - top > bottom - box.bottom)
    wrapper.classList.add("is-dropup");
}

/** @param {string} id */
function choose(id) {
  state.settings.adhanVoice = id;
  persistSettings();
  renderList();
}

async function chooseFile() {
  const result = await ipcRenderer.invoke("choose-custom-adhan");
  if (!result || result.cancelled) return false;
  if (result.error) {
    showToast(t(ERRORS[result.error] ?? "adhanCustomError"), "error");
    return false;
  }
  const playable = await canPlay(CUSTOM_ADHAN_VOICE);
  await ipcRenderer.invoke("confirm-custom-adhan", playable); // main keeps or restores
  if (!playable) {
    showToast(t("adhanCustomBroken"), "error");
    return false;
  }
  state.settings.adhanCustomName = result.name;
  choose(CUSTOM_ADHAN_VOICE);
  renderFajr();
  return true;
}

/** 🗑 on "Your own file": asks first, then the voices it was used for go back to the default. */
async function removeFile() {
  const name = String(state.settings.adhanCustomName ?? "");
  const short = name.length > 40 ? `${name.slice(0, 40)}…` : name;
  const sure = await showConfirmDialog(
    t("adhanCustomRemoveConfirm").replace("{name}", short),
    { confirmText: t("delete"), confirmClass: "btn-danger" },
  );
  if (!sure) return;
  if (previewing() === CUSTOM_ADHAN_VOICE) stopPreview();
  await ipcRenderer.invoke("remove-custom-adhan");
  state.settings.adhanCustomName = "";
  if (state.settings.adhanVoice === CUSTOM_ADHAN_VOICE)
    state.settings.adhanVoice = DEFAULT_ADHAN_VOICE;
  if (state.settings.adhanVoiceFajr === CUSTOM_ADHAN_VOICE)
    state.settings.adhanVoiceFajr = FAJR_SAME_VOICE;
  persistSettings();
  renderList();
  renderFajr();
}

const ERRORS = /** @type {Record<string, string>} */ ({
  "too-big": "adhanCustomTooBig",
  type: "adhanCustomType",
  copy: "adhanCustomError",
});

function initAdhanVoice() {
  const list = byId("adhanVoiceList", HTMLElement);
  renderList();
  renderFajr();

  list.addEventListener("change", async (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement) || !input.checked) return;
    // "Your own file" without a file yet: ask for one first
    if (input.value === CUSTOM_ADHAN_VOICE && !hasCustom()) {
      if (!(await chooseFile())) renderList(); // cancelled: back to the voice before
      return;
    }
    choose(input.value);
  });

  list.addEventListener("click", async (e) => {
    if (!(e.target instanceof Element)) return;
    const play = e.target.closest("[data-play]");
    if (play instanceof HTMLElement && play.dataset.play) {
      const ok = await togglePreview(play.dataset.play);
      if (!ok) showToast(t("adhanCustomBroken"), "error");
      return;
    }
    if (e.target.closest('[data-action="remove"]')) {
      removeFile();
      return;
    }
    if (e.target.closest('[data-action="choose"]')) {
      chooseFile();
      return;
    }
    const source = e.target.closest("[data-source]");
    if (source instanceof HTMLElement && source.dataset.source) {
      ipcRenderer.invoke("open-external", source.dataset.source);
    }
  });

  onPreviewChange(syncPlayButtons);
}

/**
 * The playing row's button turns into ■ (and says "Stop"), the others show ▶.
 * @param {string | null} id
 */
function syncPlayButtons(id) {
  byId("adhanVoiceList", HTMLElement)
    .querySelectorAll("[data-play]")
    .forEach((btn) => {
      if (!(btn instanceof HTMLElement)) return;
      const on = btn.dataset.play === id;
      btn.setAttribute("aria-pressed", String(on));
      btn.classList.toggle("is-playing", on);
      const icon = btn.querySelector("i");
      if (icon) icon.className = `fas fa-${on ? "stop" : "play"}`;
      const label = t(on ? "adhanStop" : "adhanListen").replace(
        "{voice}",
        voiceName(btn.dataset.play ?? ""),
      );
      btn.setAttribute("aria-label", label);
      btn.setAttribute("data-tip", label);
    });
}

/** After a language change. */
function updateAdhanVoiceText() {
  renderList();
  renderFajr();
}

module.exports = { initAdhanVoice, updateAdhanVoiceText };
