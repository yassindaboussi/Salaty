const localAdkar = require("../../../data/adkar.json");
const localNames = require("../../../data/99_Names_Of_Allah.json");

module.exports = {
  // adkar.json and 99_Names_Of_Allah.json are both bundled locally and used
  // directly — no more fetching from the remote GitHub repo. The adkar
  // content/counts have been hand-verified against authentic hadith (Sahih
  // al-Bukhari, Sahih Muslim, etc.), and pulling from GitHub at runtime
  // would silently overwrite those corrections whenever the app has
  // internet access.
  getAdkar: () => Promise.resolve(localAdkar),
  getNamesOfAllah: () => Promise.resolve(localNames),
};
