import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchFirefox } from './bidi.mjs';

const STORE = resolve('store');
const svg = readFileSync('static/icons/icon.svg', 'utf8');
mkdirSync(STORE, { recursive: true });
const ff = await launchFirefox({ port: 9341 });
try {
  await ff.navigate('about:blank');
  for (const size of [128, 64]) {
    const dataUrl = await ff.evaluate(`new Promise((resolve, reject) => {
      const image = new Image(${size}, ${size});
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = ${size};
        canvas.height = ${size};
        canvas.getContext('2d').drawImage(image, 0, 0, ${size}, ${size});
        resolve(canvas.toDataURL('image/png'));
      };
      image.onerror = reject;
      image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(${JSON.stringify(svg.replace('<svg ', `<svg width="${size}" height="${size}" `))});
    })`);
    writeFileSync(join(STORE, `icon-${size}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
  }
  console.log(`Icons -> ${STORE}`);
} finally {
  ff.close();
}
