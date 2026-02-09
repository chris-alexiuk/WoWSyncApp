import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const OUTPUT_DIR = path.resolve('build');
const PNG_PATH = path.join(OUTPUT_DIR, 'icon.png');
const ICO_PATH = path.join(OUTPUT_DIR, 'icon.ico');

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function colorLerp(a, b, t) {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
    Math.round(lerp(a[3], b[3], t)),
  ];
}

function isInsideRoundedRect(x, y, left, top, right, bottom, radius) {
  if (x < left || x > right || y < top || y > bottom) {
    return false;
  }

  const innerLeft = left + radius;
  const innerRight = right - radius;
  const innerTop = top + radius;
  const innerBottom = bottom - radius;

  if (x >= innerLeft && x <= innerRight) {
    return true;
  }

  if (y >= innerTop && y <= innerBottom) {
    return true;
  }

  const corners = [
    [innerLeft, innerTop],
    [innerRight, innerTop],
    [innerLeft, innerBottom],
    [innerRight, innerBottom],
  ];

  for (const [cx, cy] of corners) {
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy <= radius * radius) {
      return true;
    }
  }

  return false;
}

function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    const sx = px - x1;
    const sy = py - y1;
    return Math.sqrt(sx * sx + sy * sy);
  }

  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lengthSq, 0, 1);
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  const ddx = px - projX;
  const ddy = py - projY;
  return Math.sqrt(ddx * ddx + ddy * ddy);
}

function drawSegment(pixels, size, x1, y1, x2, y2, thickness, color) {
  const half = thickness / 2;
  const minX = Math.floor(Math.min(x1, x2) - half - 1);
  const maxX = Math.ceil(Math.max(x1, x2) + half + 1);
  const minY = Math.floor(Math.min(y1, y2) - half - 1);
  const maxY = Math.ceil(Math.max(y1, y2) + half + 1);

  for (let y = minY; y <= maxY; y += 1) {
    if (y < 0 || y >= size) {
      continue;
    }

    for (let x = minX; x <= maxX; x += 1) {
      if (x < 0 || x >= size) {
        continue;
      }

      const distance = pointToSegmentDistance(x + 0.5, y + 0.5, x1, y1, x2, y2);
      if (distance <= half) {
        const idx = (y * size + x) * 4;
        pixels[idx] = color[0];
        pixels[idx + 1] = color[1];
        pixels[idx + 2] = color[2];
        pixels[idx + 3] = color[3];
      }
    }
  }
}

function drawArc(pixels, size, cx, cy, radius, startAngle, endAngle, thickness, color) {
  const half = thickness / 2;
  const minX = Math.floor(cx - radius - half - 1);
  const maxX = Math.ceil(cx + radius + half + 1);
  const minY = Math.floor(cy - radius - half - 1);
  const maxY = Math.ceil(cy + radius + half + 1);

  for (let y = minY; y <= maxY; y += 1) {
    if (y < 0 || y >= size) {
      continue;
    }

    for (let x = minX; x <= maxX; x += 1) {
      if (x < 0 || x >= size) {
        continue;
      }

      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (Math.abs(distance - radius) > half) {
        continue;
      }

      let angle = Math.atan2(dy, dx);
      if (angle < 0) {
        angle += Math.PI * 2;
      }

      const inRange = startAngle <= endAngle
        ? angle >= startAngle && angle <= endAngle
        : angle >= startAngle || angle <= endAngle;

      if (!inRange) {
        continue;
      }

      const idx = (y * size + x) * 4;
      pixels[idx] = color[0];
      pixels[idx + 1] = color[1];
      pixels[idx + 2] = color[2];
      pixels[idx + 3] = color[3];
    }
  }
}

function drawIconPixels(size) {
  const pixels = new Uint8Array(size * size * 4);

  const margin = Math.round(size * 0.1);
  const radius = Math.round(size * 0.24);
  const left = margin;
  const top = margin;
  const right = size - margin - 1;
  const bottom = size - margin - 1;

  const startColor = [114, 244, 205, 255];
  const endColor = [79, 140, 255, 255];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!isInsideRoundedRect(x, y, left, top, right, bottom, radius)) {
        continue;
      }

      const gradientT = clamp((x + y) / ((size - 1) * 1.75), 0, 1);
      const color = colorLerp(startColor, endColor, gradientT);
      const idx = (y * size + x) * 4;
      pixels[idx] = color[0];
      pixels[idx + 1] = color[1];
      pixels[idx + 2] = color[2];
      pixels[idx + 3] = color[3];
    }
  }

  const accent = [7, 18, 31, 255];
  const thick = Math.max(8, Math.round(size * 0.075));

  drawSegment(
    pixels,
    size,
    Math.round(size * 0.32),
    Math.round(size * 0.67),
    Math.round(size * 0.47),
    Math.round(size * 0.31),
    thick,
    accent,
  );
  drawSegment(
    pixels,
    size,
    Math.round(size * 0.47),
    Math.round(size * 0.31),
    Math.round(size * 0.68),
    Math.round(size * 0.73),
    thick,
    accent,
  );
  drawSegment(
    pixels,
    size,
    Math.round(size * 0.37),
    Math.round(size * 0.53),
    Math.round(size * 0.58),
    Math.round(size * 0.53),
    Math.max(6, Math.round(size * 0.055)),
    accent,
  );

  drawArc(
    pixels,
    size,
    Math.round(size * 0.52),
    Math.round(size * 0.55),
    Math.round(size * 0.34),
    Math.PI * 1.7,
    Math.PI * 0.04,
    Math.max(4, Math.round(size * 0.038)),
    accent,
  );

  drawArc(
    pixels,
    size,
    Math.round(size * 0.46),
    Math.round(size * 0.45),
    Math.round(size * 0.35),
    Math.PI * 0.62,
    Math.PI * 1.28,
    Math.max(4, Math.round(size * 0.038)),
    accent,
  );

  return pixels;
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);

  const crcBuffer = Buffer.alloc(4);
  const crcValue = crc32(Buffer.concat([typeBuffer, data]));
  crcBuffer.writeUInt32BE(crcValue >>> 0, 0);

  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function encodePng(width, height, pixels) {
  const rowSize = width * 4;
  const raw = Buffer.alloc((rowSize + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (rowSize + 1);
    raw[rowStart] = 0;
    const sourceStart = y * rowSize;
    pixels.copy(raw, rowStart + 1, sourceStart, sourceStart + rowSize);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function encodeIcoWithPng(pngBuffer) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry[0] = 0;
  entry[1] = 0;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(22, 12);

  return Buffer.concat([header, entry, pngBuffer]);
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const pngPixels = Buffer.from(drawIconPixels(512));
  const pngBuffer = encodePng(512, 512, pngPixels);
  await fs.writeFile(PNG_PATH, pngBuffer);

  const icoPixels = Buffer.from(drawIconPixels(256));
  const icoPngBuffer = encodePng(256, 256, icoPixels);
  const icoBuffer = encodeIcoWithPng(icoPngBuffer);
  await fs.writeFile(ICO_PATH, icoBuffer);

  console.log(`Generated ${path.relative(process.cwd(), PNG_PATH)}`);
  console.log(`Generated ${path.relative(process.cwd(), ICO_PATH)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
