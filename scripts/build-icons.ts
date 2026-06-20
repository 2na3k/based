import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const PUBLIC_DIR = join(process.cwd(), "public");
const ICONS_DIR = join(PUBLIC_DIR, "icons");
const LOGO_PATH = join(PUBLIC_DIR, "logo.svg");

const iconSizes = [16, 32, 48, 128, 256, 512] as const;

await mkdir(ICONS_DIR, { recursive: true });

await Promise.all(
  iconSizes.map((size) =>
    sharp(LOGO_PATH)
      .resize(size, size)
      .png()
      .toFile(join(ICONS_DIR, `icon-${size}.png`)),
  ),
);

await sharp(LOGO_PATH).resize(180, 180).png().toFile(join(PUBLIC_DIR, "apple-touch-icon.png"));
await sharp(LOGO_PATH).resize(32, 32).png().toFile(join(PUBLIC_DIR, "favicon.png"));

console.log(`Built ${iconSizes.length + 2} logo icon assets`);
