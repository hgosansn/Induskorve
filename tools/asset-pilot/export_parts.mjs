import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const started = performance.now();
const root = process.argv[2] ?? 'asset-studies/parts-batch-01';
const output = process.argv[3] ?? 'src/rendering/assets/parts-batch-01';
await mkdir(output, { recursive: true });
const build = JSON.parse(await readFile(`${root}/build.json`, 'utf8'));
const server = await createServer({
  configLoader: 'native',
  server: { host: '127.0.0.1', port: 0 },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
  const parts = [];
  for (const part of build.parts) {
    const start = performance.now();
    const expected = [
      [-2.25, 1.125],
      [2.25, 1.125],
      [0, -3],
    ];
    if (
      !part.projection?.every((axis, i) =>
        axis.every(
          (v, j) => Math.abs(v * part.cityScale - expected[i][j]) < 0.0001,
        ),
      )
    )
      throw Error(`Camera projection drift: ${part.id}`);
    const encoded = await page.evaluate(
      async ({ url, part }) => {
        const image = new Image();
        image.src = url;
        await image.decode();
        const source = document.createElement('canvas');
        source.width = image.width;
        source.height = image.height;
        const ctx = source.getContext('2d');
        ctx.drawImage(image, 0, 0);
        const rgba = ctx.getImageData(0, 0, source.width, source.height).data;
        let x0 = source.width,
          y0 = source.height,
          x1 = 0,
          y1 = 0;
        for (let y = 0; y < source.height; y++)
          for (let x = 0; x < source.width; x++) {
            if (rgba[(y * source.width + x) * 4 + 3] > 0) {
              x0 = Math.min(x0, x);
              x1 = Math.max(x1, x);
              y0 = Math.min(y0, y);
              y1 = Math.max(y1, y);
            }
          }
        if (x1 <= x0 || y1 <= y0) throw Error('Empty render');
        // Transparent safety border preserves antialiased edge pixels.
        x0 = Math.max(0, x0 - 2);
        y0 = Math.max(0, y0 - 2);
        x1 = Math.min(source.width - 1, x1 + 2);
        y1 = Math.min(source.height - 1, y1 + 2);
        const width = x1 - x0 + 1,
          height = y1 - y0 + 1;
        const images = [];
        for (const edge of [256, 512]) {
          const scale = edge / Math.max(width, height);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(width * scale);
          canvas.height = Math.round(height * scale);
          const target = canvas.getContext('2d');
          target.translate(canvas.width, 0);
          target.scale(-1, 1);
          target.drawImage(
            source,
            x0,
            y0,
            width,
            height,
            0,
            0,
            canvas.width,
            canvas.height,
          );
          const data = canvas.toDataURL('image/webp', 0.88);
          if (!data.startsWith('data:image/webp'))
            throw Error('WebP unsupported');
          images.push({
            edge,
            width: canvas.width,
            height: canvas.height,
            origin: [
              canvas.width - ((part.origin[0] - x0) * canvas.width) / width,
              ((part.origin[1] - y0) * canvas.height) / height,
            ],
            cityScale: [
              (part.cityScale * width) / canvas.width,
              (part.cityScale * height) / canvas.height,
            ],
            base64: data.split(',')[1],
          });
        }
        return images;
      },
      { url: `/${root}/${part.id}/preview.png`, part },
    );
    const variants = {};
    for (const image of encoded) {
      const file = `${part.id}-${image.edge}.webp`,
        bytes = Buffer.from(image.base64, 'base64');
      await writeFile(`${output}/${file}`, bytes);
      variants[image.edge] = {
        edge: image.edge,
        width: image.width,
        height: image.height,
        origin: image.origin,
        cityScale: image.cityScale,
        file,
        bytes: bytes.length,
      };
    }
    parts.push({
      ...part,
      variants,
      encodingSeconds: (performance.now() - start) / 1000,
      sourceBytes: (await stat(`${root}/${part.id}/source.blend`)).size,
      glbBytes: (await stat(`${root}/${part.id}/master.glb`)).size,
    });
  }
  const replacedParts = [...parts];
  if (process.argv.includes('--merge')) {
    const existing = JSON.parse(
      await readFile(`${output}/catalog.json`, 'utf8'),
    );
    const ids = new Set(parts.map((p) => p.id));
    parts.unshift(...existing.parts.filter((p) => !ids.has(p.id)));
  }
  const report = {
    schemaVersion: 1,
    batch: output.split('/').at(-1),
    camera: 'city-fixed',
    units: '12-unit kit',
    activeIdleShared: true,
    parts,
    regeneratedIds: replacedParts.map((p) => p.id),
    buildSeconds: build.seconds,
    encodingSeconds: (performance.now() - started) / 1000,
    cityBytes: parts.reduce((n, p) => n + p.variants[256].bytes, 0),
    closeBytes: parts.reduce((n, p) => n + p.variants[512].bytes, 0),
  };
  await writeFile(
    `${output}/catalog.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  await writeFile(
    `${root}/delivery-report.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      parts: parts.length,
      buildSeconds: report.buildSeconds,
      encodingSeconds: report.encodingSeconds,
      cityBytes: report.cityBytes,
      closeBytes: report.closeBytes,
      output: resolve(output),
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
