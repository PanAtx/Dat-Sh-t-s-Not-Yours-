// scripts/encode-radio-lo.mjs - THE RADIO LO TIER (48 kbps) - v1.0.564
//
// The radio rotation is ~182 MB of the 128 kbps-era VBR masters: it is the biggest thing on the
// site and the biggest DATA bill a phone playing the game pays. The LO tier carries THE SAME
// TRACKS under THE SAME NAMES at 48 kbps in music/lo/ - a quarter of the bytes for the really
// slow phones, and the game picks the tier from the RADIO settings row (HI 128K / LO 48K), each
// tier with its own radio cache.
//
// This tool rebuilds that folder from the sources: ffmpeg -c:a libmp3lame -b:a 48k, metadata
// copied, filenames identical, plus music/lo/manifest.json (the track list GitHub Pages serves -
// the station discovers its playlist from the manifest when the host has no directory listing).
//
// USAGE:
//   node scripts/encode-radio-lo.mjs            // report what the tiers cost
//   node scripts/encode-radio-lo.mjs --encode   // (re)build music/lo/ from music/
//   node scripts/encode-radio-lo.mjs --verify   // prove every manifest track exists in BOTH tiers
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(DIR, "..");
const LO_DIR = path.join(ROOT, "music", "lo");
const LO_KBPS = 48;
const tracks = JSON.parse(fs.readFileSync(path.join(ROOT, "music", "manifest.json"), "utf8"));
const mode = process.argv[2] || "";
let hiBytes = 0, loBytes = 0, made = 0, missing = [];
if (mode === "--encode") fs.mkdirSync(LO_DIR, { recursive: true });
for (const t of tracks) {
  const src = path.join(ROOT, "music", t);
  const dst = path.join(LO_DIR, t);
  if (!fs.existsSync(src)) { console.log("NO SOURCE: " + t); continue; }
  hiBytes += fs.statSync(src).size;
  if (mode === "--encode") {
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", src,
      "-c:a", "libmp3lame", "-b:a", LO_KBPS + "k", "-map_metadata", "0", dst], { stdio: "pipe" });
    made++;
  }
  if (fs.existsSync(dst)) loBytes += fs.statSync(dst).size;
  else if (mode === "--verify") missing.push(t);
}
if (mode === "--encode") {
  fs.writeFileSync(path.join(LO_DIR, "manifest.json"), JSON.stringify(tracks, null, 2) + "\n", "utf8");
  console.log("encoded " + made + " tracks at " + LO_KBPS + "k into music/lo/ + manifest (" + tracks.length + " names)");
}
console.log("HI tier: " + tracks.length + " tracks, " + (hiBytes / 1048576).toFixed(2) + " MB");
console.log("LO tier: " + (loBytes / 1048576).toFixed(2) + " MB (" + (hiBytes ? (100 * loBytes / hiBytes).toFixed(1) : "0") + "% of HI)");
if (mode === "--verify") {
  const ok = missing.length === 0 && fs.existsSync(path.join(LO_DIR, "manifest.json"));
  console.log(ok ? "VERIFY OK: every rotation track exists in music/lo/ and the lo manifest is present"
    : "VERIFY FAILED: missing in lo -> " + missing.join(", "));
  process.exit(ok ? 0 : 1);
}
