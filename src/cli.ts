#!/usr/bin/env node

import { Jimp } from "jimp";

import { generateDiffImages, rasterize } from "./index.js";
import type { DiffImageChunk } from "./index.js";

const main = async () => {
  try {
    if (process.argv.length < 5) {
      console.error("Usage: rasterdiff <before.png> <after.png> <output.png>");
      process.exitCode = 2;
      return;
    }
    const [, , beforePath, afterPath, outputPath] = process.argv;

    const chunks = await Array.fromAsync(
      generateDiffImages(await loadPNG(beforePath), await loadPNG(afterPath)),
    );

    await writeDiffPNG(outputPath, chunks);

    const different = chunks.some((chunk) => chunk.different);
    process.exitCode = different ? 1 : 0;
  } catch (exception) {
    console.error(exception);
    process.exitCode = 2;
  }
};

const loadPNG = async (filePath: string) => {
  try {
    const image = await Jimp.read(filePath);
    const { width, height, data } = image.bitmap;

    return await rasterize({
      width,
      height,
      data: new Uint8ClampedArray(
        data.buffer,
        data.byteOffset,
        data.byteLength,
      ),
    });
  } catch (exception) {
    throw new Error(`Failed to read PNG: ${filePath}`, { cause: exception });
  }
};

const combineChunks = (chunks: DiffImageChunk[]) => {
  const width = chunks.reduce(
    (max, chunk) => Math.max(max, chunk.width),
    -Infinity,
  );
  const height = chunks.reduce((sum, chunk) => sum + chunk.height, 0);
  const data = new Uint8ClampedArray(width * height * 4);

  let offsetY = 0;
  for (const chunk of chunks) {
    for (let y = 0; y < chunk.height; y++) {
      const sourceStart = y * chunk.width * 4;
      const sourceEnd = sourceStart + chunk.width * 4;
      const targetStart = (offsetY + y) * width * 4;
      data.set(chunk.data.slice(sourceStart, sourceEnd), targetStart);
    }

    offsetY += chunk.height;
  }

  return { width, height, data };
};

const writeDiffPNG = async (outputPath: string, chunks: DiffImageChunk[]) => {
  try {
    const image = Jimp.fromBitmap(combineChunks(chunks));
    await image.write(outputPath);
  } catch (exception) {
    throw new Error(`Failed to write PNG: ${outputPath}`, { cause: exception });
  }
};

await main();
