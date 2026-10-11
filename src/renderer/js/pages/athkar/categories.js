"use strict";

// The sidebar's category groups and the categories' names in the app language.
const { t } = require("../../core/i18n");

// Groups categories into meaningful sections for the sidebar, so 50+
// categories stay browsable instead of one long flat list. Each entry maps
// a group label (translation key) to the exact category names it contains
// (these must match the keys in adkar.json). A category not listed here
// automatically falls into "أخرى" (Other) as a safety net.
const CATEGORY_GROUPS = [
  {
    key: "groupMorningEvening",
    icon: "fa-sun",
    categories: ["أذكار الصباح", "أذكار المساء"],
  },
  {
    key: "groupPrayer",
    icon: "fa-mosque",
    categories: [
      "أذكار بعد السلام من الصلاة المفروضة",
      "أذكار الآذان",
      "دعاء صلاة الاستخارة",
      "دعاء الذهاب إلى المسجد",
      "دعاء دخول المسجد",
      "دعاء الخروج من المسجد",
    ],
  },
  {
    key: "groupHomePurity",
    icon: "fa-house",
    categories: [
      "الذكر قبل الوضوء",
      "الذكر بعد الفراغ من الوضوء",
      "الذكر عند الخروج من المنزل",
      "الذكر عند دخول المنزل",
      "دعاء دخول الخلاء",
      "دعاء الخروج من الخلاء",
      "دعاء لبس الثوب",
    ],
  },
  {
    key: "groupSleepWake",
    icon: "fa-moon",
    categories: ["أذكار النوم", "أذكار الاستيقاظ"],
  },
  {
    key: "groupTasbihIstighfar",
    icon: "fa-hand-holding-heart",
    categories: [
      "تسابيح",
      "فضل الاستغفار",
      "ما يقال في المجلس",
      "كفارة المجلس",
    ],
  },
  {
    key: "groupFoodFasting",
    icon: "fa-utensils",
    categories: [
      "الدعاء قبل الطعام",
      "الدعاء عند الفراغ من الطعام",
      "دعاء الضيف لصاحب الطعام",
      "الدعاء عند إفطار الصائم",
    ],
  },
  {
    key: "groupTravel",
    icon: "fa-plane",
    categories: [
      "دعاء الركوب",
      "دعاء السفر",
      "دعاء دخول القرية أو البلدة",
      "دعاء دخول السوق",
      "دعاء المسافر للمقيم والمقيم للمسافر",
      "ذكر الرجوع من السفر",
    ],
  },
  {
    key: "groupNature",
    icon: "fa-cloud-showers-heavy",
    categories: [
      "دعاء الريح",
      "دعاء الرعد",
      "الدعاء إذا نزل المطر",
      "الذكر بعد نزول المطر",
      "دعاء رؤية الهلال",
    ],
  },
  {
    key: "groupSocial",
    icon: "fa-people-arrows",
    categories: [
      "إفشاء السلام",
      "الدعاء لمن قال بارك الله فيك",
      "تهنئة المولود له وجوابه",
      "الدعاء للمتزوج",
      "دعاء العطاس",
      "دعاء التعجب والأمر السار",
      "من آداب الذكر الجامعة",
    ],
  },
  {
    key: "groupDistress",
    icon: "fa-shield-heart",
    categories: [
      "دعاء الهم والحزن",
      "دعاء الكرب",
      "دعاء لقاء العدو وذي السلطان",
      "ما يقول من خاف قوماً",
      "دعاء قضاء الدين",
      "دعاء الغضب",
      "دعاء من رأى مبتلى",
      "ما يقال عند الفزع",
      "ما يقول من أحسّ وجعاً في جسده",
    ],
  },
  {
    key: "groupSicknessDeath",
    icon: "fa-hand-holding-medical",
    categories: [
      "الدعاء للمريض في عيادته",
      "دعاء من أصيب بمصيبة",
      "دعاء زيارة القبور",
    ],
  },
  {
    key: "groupQuranProphets",
    icon: "fa-book-quran",
    categories: ["أدعية قرآنية", "أدعية الأنبياء"],
  },
];

// Category names in adkar.json are Arabic and double as lookup keys, so they stay
// untouched; only what the user sees is translated through these locale keys.
const CATEGORY_KEYS = {
  "أذكار الصباح": "cat_morning",
  "أذكار المساء": "cat_evening",
  "أذكار بعد السلام من الصلاة المفروضة": "cat_afterPrayer",
  تسابيح: "cat_tasbih",
  "أذكار النوم": "cat_sleep",
  "أذكار الاستيقاظ": "cat_wake",
  "أدعية قرآنية": "cat_quranDuas",
  "أدعية الأنبياء": "cat_prophetsDuas",
  "دعاء الغضب": "cat_anger",
};

// Falls back to the raw Arabic name for a category without a translation key.
function categoryLabel(name) {
  const key = CATEGORY_KEYS[name];
  const label = key ? t(key) : null;
  return label && label !== key ? label : name;
}

function categoryMatches(name, query) {
  const q = query.toLowerCase();
  return name.includes(query) || categoryLabel(name).toLowerCase().includes(q);
}

module.exports = { CATEGORY_GROUPS, categoryLabel, categoryMatches };
