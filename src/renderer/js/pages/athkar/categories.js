"use strict";

// The categories in the side panel: two sections (the daily athkar, then the duas), their icons
// and their names in the app language. The names in adkar.json are Arabic and are the lookup
// keys, so they stay as they are. A category the data has but this list does not shows at the
// end of the second section with its Arabic name.
const { t } = require("../../core/i18n");

const SECTIONS = [
  {
    key: "akSectionDaily",
    categories: [
      { name: "أذكار الصباح", key: "cat_morning", icon: "fa-sun" },
      { name: "أذكار المساء", key: "cat_evening", icon: "fa-cloud-sun" },
      {
        name: "أذكار بعد السلام من الصلاة المفروضة",
        key: "cat_afterPrayer",
        icon: "fa-mosque",
      },
      { name: "أذكار النوم", key: "cat_sleep", icon: "fa-moon" },
      { name: "أذكار الاستيقاظ", key: "cat_wake", icon: "fa-bed" },
    ],
  },
  {
    key: "akSectionDuas",
    categories: [
      { name: "تسابيح", key: "cat_tasbih", icon: "fa-hand-holding-heart" },
      { name: "أدعية قرآنية", key: "cat_quranDuas", icon: "fa-book-quran" },
      {
        name: "أدعية الأنبياء",
        key: "cat_prophetsDuas",
        icon: "fa-book-open",
      },
      { name: "دعاء الغضب", key: "cat_anger", icon: "fa-heart-pulse" },
    ],
  },
];

const MORNING = "أذكار الصباح";
const EVENING = "أذكار المساء";

/** @param {string} name */
const findCategory = (name) =>
  SECTIONS.flatMap((s) => s.categories).find((c) => c.name === name);

/** @param {string} name  the category's name in the app language */
function categoryLabel(name) {
  const known = findCategory(name);
  return known ? t(known.key) : name;
}

/** @param {string} name */
const categoryIcon = (name) => findCategory(name)?.icon ?? "fa-book-open";

/**
 * The sections with the categories the data really has, in order.
 * @param {Record<string, unknown[]>} data
 */
function sectionsFor(data) {
  const listed = new Set(
    SECTIONS.flatMap((s) => s.categories.map((c) => c.name)),
  );
  const extra = Object.keys(data).filter((name) => !listed.has(name));
  return SECTIONS.map((section, i) => ({
    key: section.key,
    names: [
      ...section.categories.map((c) => c.name).filter((name) => data[name]),
      ...(i === SECTIONS.length - 1 ? extra : []),
    ],
  })).filter((section) => section.names.length);
}

module.exports = {
  MORNING,
  EVENING,
  categoryLabel,
  categoryIcon,
  sectionsFor,
};
