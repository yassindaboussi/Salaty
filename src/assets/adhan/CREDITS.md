# Adhan recordings

The voices in Settings → Notifications → Adhan voice. Each file was cut at the start
(silence or crowd noise), given a 2-second fade-out, set to -12 LUFS and saved as mono MP3,
96 kbps. The list the app reads is `src/shared/adhan-voices.js`.

| File | Recording | Source | Licence |
| --- | --- | --- | --- |
| makkah.mp3 | Adhan at Masjid al-Haram, Makkah, 21 January 2013, recorded by Seyfula Islam | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Adhan,_Great_Mosque_of_Mecca_-_Jan_21,_2013.webm) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |
| madinah.mp3 | Call to prayer from the Prophet's Mosque, Madinah, recorded by ejaz215 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:33937_ejaz215_call-to-prayer-from-the-prophet-s-mo.ogg) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |
| aleppo.mp3 | Call to prayer by Sabah Fakhri | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Call_to_prayer_by_Sabah_Fakhry.mp3) | Public domain |
| short.mp3 | The Adhan, Aaqib Azeez, uploaded by Atcovi | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:The_Adhan_-_Muslim_Call_to_Prayer_-_Aaqib_Azeez.mp3) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/): this edited file is shared under the same licence |

## Short tone

`short-tone.wav` is the "Short tone" reminder on the home page: two plain 660 Hz sine notes (0.4 s each, 0.18 s apart) with soft fades, no melody and no bell sound. Made for this app by a small script, no outside recording, so no licence applies.

## Voice reminders (`voice/`)

Settings → Notifications → Voice reminders. Voices generated with [Grok](https://grok.com) by xAI: the
user owns the output and may use it commercially ([xAI FAQ](https://x.ai/legal/faq)). Saved as mono MP3,
96 kbps, with no other change.

- `near-fajr.mp3` … `near-isha.mp3`: "اقتربت صلاة …", one per prayer.
- `hadith-before.mp3`: «صلاةُ الجماعةِ أفضلُ من صلاةِ الفذِّ بسبعٍ وعشرينَ درجةً», agreed upon:
  [Sahih Muslim 650](https://sunnah.com/muslim:650a) (this wording) and
  [Sahih al-Bukhari 645](https://sunnah.com/bukhari:645).
- `hadith-after.mp3`: «مَنْ قَالَ حِينَ يَسْمَعُ النِّدَاءَ: اللَّهُمَّ رَبَّ هَذِهِ الدَّعْوَةِ التَّامَّةِ… حَلَّتْ لَهُ شَفَاعَتِي يَوْمَ الْقِيَامَةِ».
  [Sahih al-Bukhari 614](https://sunnah.com/bukhari:614).
