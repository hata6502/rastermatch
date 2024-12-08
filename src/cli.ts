#! /usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

import { PNG } from "pngjs";

import { diffRasters, generateDiffImage, rasterize } from "./index.js";

const [, , oldPath, newPath, diffPath] = process.argv;
if (!oldPath || !newPath || !diffPath) {
  console.error("Usage: rastermatch old.png new.png output.png");
  process.exit(1);
}

const oldPNG = PNG.sync.read(await readFile(oldPath));
const newPNG = PNG.sync.read(await readFile(newPath));

const diff = diffRasters(
  await rasterize({
    width: oldPNG.width,
    height: oldPNG.height,
    data: new Uint8ClampedArray(oldPNG.data),
  }),
  await rasterize({
    width: newPNG.width,
    height: newPNG.height,
    data: new Uint8ClampedArray(newPNG.data),
  })
);

const diffImage = generateDiffImage(diff);
const diffPNG = new PNG({ width: diffImage.width, height: diffImage.height });
diffPNG.data.set(diffImage.data);
await writeFile(diffPath, PNG.sync.write(diffPNG));
