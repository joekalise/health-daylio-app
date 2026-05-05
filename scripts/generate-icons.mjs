import sharp from "sharp";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(join(__dirname, "../public/icon.svg"));
const out = (name) => join(__dirname, "../public", name);

await sharp(svg).resize(512, 512).png().toFile(out("icon-512.png"));
await sharp(svg).resize(192, 192).png().toFile(out("icon-192.png"));
await sharp(svg).resize(180, 180).png().toFile(out("apple-touch-icon.png"));

console.log("Icons generated: icon-512.png, icon-192.png, apple-touch-icon.png");
