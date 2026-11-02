// Draws the app icons into public/. Run with: npm run icons
// The PNGs are committed, so this only needs re-running if the artwork changes.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const SIZE = 1024;

function artwork(ballRadius) {
  const r = ballRadius;
  const seam = `fill="none" stroke="#04202F" stroke-opacity=".55" stroke-width="${r * 0.07}" stroke-linecap="round"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0E1A33"/><stop offset="1" stop-color="#060A14"/></linearGradient>
    <linearGradient id="ball" x1="0.15" y1="0" x2="0.85" y2="1"><stop offset="0" stop-color="#7DD8FF"/><stop offset="1" stop-color="#2563EB"/></linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#38BDF8" stop-opacity=".35"/><stop offset="1" stop-color="#38BDF8" stop-opacity="0"/></radialGradient>
    <clipPath id="clip"><circle cx="0" cy="0" r="${r}"/></clipPath>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>
  <circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${r * 1.45}" fill="url(#glow)"/>
  <g transform="translate(${SIZE / 2} ${SIZE / 2})">
    <circle r="${r}" fill="url(#ball)"/>
    <g clip-path="url(#clip)">
      <path d="M ${-r} ${-r * 0.2} C ${-r * 0.4} ${-r * 0.75}, ${r * 0.4} ${-r * 0.75}, ${r} ${-r * 0.2}" ${seam}/>
      <path d="M ${-r * 0.55} ${-r * 0.95} C ${-r * 0.1} ${-r * 0.3}, ${-r * 0.1} ${r * 0.3}, ${-r * 0.55} ${r * 0.95}" ${seam}/>
      <path d="M ${r * 0.55} ${-r * 0.95} C ${r * 0.1} ${-r * 0.3}, ${r * 0.1} ${r * 0.3}, ${r * 0.55} ${r * 0.95}" ${seam}/>
      <path d="M ${-r} ${r * 0.35} C ${-r * 0.4} ${r * 0.8}, ${r * 0.4} ${r * 0.8}, ${r} ${r * 0.35}" ${seam}/>
    </g>
  </g>
</svg>`;
}

// Normal icons fill the square. Maskable icons keep everything inside the
// central 80% so Android can crop them to a circle or squircle.
const regular = Buffer.from(artwork(370));
const maskable = Buffer.from(artwork(290));

await mkdir('public', { recursive: true });
const out = [
  ['icon-512.png', regular, 512],
  ['icon-192.png', regular, 192],
  ['apple-touch-icon.png', regular, 180],
  ['icon-maskable-512.png', maskable, 512],
  ['favicon-32.png', regular, 32],
];
for (const [name, svg, size] of out) {
  await sharp(svg).resize(size, size).png().toFile(`public/${name}`);
  console.log('wrote public/' + name);
}
