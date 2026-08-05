const GITHUB_BASE_URL =
  "https://raw.githubusercontent.com/yassindaboussi/Salaty/main/src/renderer/data";

const localAdkar = require("../../../data/adkar.json");
const localNames = require("../../../data/99_Names_Of_Allah.json");

async function fetchWithFallback(filename, fallbackData) {
  try {
    const response = await fetch(`${GITHUB_BASE_URL}/${filename}`);
    if (!response.ok) {
      throw new Error(`Status ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch {
    return fallbackData;
  }
}

module.exports = {
  getAdkar: () => fetchWithFallback("adkar.json", localAdkar),
  getNamesOfAllah: () =>
    fetchWithFallback("99_Names_Of_Allah.json", localNames),
};
