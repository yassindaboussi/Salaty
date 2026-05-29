// src/renderer/js/trackUtils.js

/**
 * Récupère la liste des pistes MP3 depuis une URL Archive.org (format Salaty)
 * @param {string} archiveUrl - L'URL de métadonnées Archive.org
 * @returns {Promise<Array<{title: string, artist: string, url: string, filename: string}>>}
 * @throws {Error} si la récupération échoue ou si le format est invalide
 */
async function getArchiveOrgTracks(archiveUrl) {
  const response = await fetch(archiveUrl);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  if (!data.files || !data.d1 || !data.dir) {
    throw new Error("Invalid Archive.org metadata");
  }
  const server = data.d1;
  const dir = data.dir;
  const baseUrl = `https://${server}${dir}/`;
  const mp3Files = data.files.filter((f) =>
    f.name.toLowerCase().endsWith(".mp3"),
  );
  return mp3Files.map((file) => ({
    title: file.title || file.name.replaceAll(".mp3", "").replaceAll("_", " "),
    artist:
      file.creator || file.artist || data.metadata?.creator || "Unknown Artist",
    url: baseUrl + encodeURIComponent(file.name),
    filename: file.name,
  }));
}

module.exports = { getArchiveOrgTracks };
