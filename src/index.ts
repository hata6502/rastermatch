import { Buffer } from "node:buffer";
import { readFile, writeFile } from "node:fs/promises";

import { diffArrays } from "diff";
import { PNG } from "pngjs";

const mixColor = (
  target: Uint8Array,
  index: number,
  [r, g, b, a]: [number, number, number, number],
  ratio: number
) => {
  target[index + 0] = Math.round(target[index + 0] * (1 - ratio) + r * ratio);
  target[index + 1] = Math.round(target[index + 1] * (1 - ratio) + g * ratio);
  target[index + 2] = Math.round(target[index + 2] * (1 - ratio) + b * ratio);
  target[index + 3] = Math.round(target[index + 3] * (1 - ratio) + a * ratio);
};

const pixelize = (raster: Buffer) => {
  const rasterArray = [...raster];

  const pixels = [];
  let count = 1;
  let current = rasterArray.slice(0, 4).join("-");
  for (let index = 4; index < raster.length; index += 4) {
    const pixel = rasterArray.slice(index, index + 4).join("-");

    if (pixel !== current) {
      pixels.push(`${count},${current}`);
      count = 1;
      current = pixel;
    } else {
      count++;
    }
  }
  pixels.push(`${count},${current}`);
  return pixels;
};

const rasterize = async (png: PNG) => {
  const rasters = [];
  for (let y = 0; y < png.height; y++) {
    rasters.push(png.data.subarray(y * png.width * 4, (y + 1) * png.width * 4));
  }
  return rasters;
};

const oldPNG = PNG.sync.read(await readFile("a.png"));
const newPNG = PNG.sync.read(await readFile("b.png"));

const diff = diffArrays(await rasterize(oldPNG), await rasterize(newPNG), {
  comparator: (left, right) => left.equals(right),
});

const diffHeight = diff.reduce((sum, { value }) => sum + value.length, 0);
const diffPNG = new PNG({
  width: Math.max(oldPNG.width, newPNG.width),
  height: diffHeight,
});
let diffY = 0;
for (const [diffIndex, { value, added, removed }] of diff.entries()) {
  const pixelmatch =
    added && diffIndex >= 1 && diff[diffIndex - 1].removed
      ? diff[diffIndex - 1]
      : removed && diffIndex < diff.length - 1 && diff[diffIndex + 1].added
      ? diff[diffIndex + 1]
      : undefined;
  const pixelmatchRasters = pixelmatch?.value.map(pixelize);

  for (const raster of value) {
    const pixels = pixelize(raster);
    const [, nearestDiff] =
      pixelmatchRasters
        ?.map((pixelmatchRaster) => {
          const diff = diffArrays(pixelmatchRaster, pixels);
          return [
            diff.reduce((sum, { count }) => sum + (count ?? 0), 0),
            diff,
          ] as const;
        })
        .toSorted(([a], [b]) => a - b)
        .at(0) ?? [];

    const mask = nearestDiff?.flatMap(({ value, added }) =>
      Array(
        value.reduce((sum, pixel) => sum + Number(pixel.split(",")[0]), 0)
      ).fill(added ?? false)
    );

    const coloredRaster = Uint8Array.from(raster);
    for (
      let rasterIndex = 0;
      rasterIndex < coloredRaster.length;
      rasterIndex += 4
    ) {
      if (mask?.at(rasterIndex / 4) === false) {
        continue;
      }

      if (added) {
        mixColor(coloredRaster, rasterIndex, [34, 220, 71, 255], 0.125);
      } else if (removed) {
        mixColor(coloredRaster, rasterIndex, [255, 12, 0, 255], 0.125);
      }
    }

    diffPNG.data.set(coloredRaster, diffY * diffPNG.width * 4);
    diffY++;
    console.log(`${(diffY / diffHeight) * 100}%`);
  }
}
await writeFile("diff.png", PNG.sync.write(diffPNG));
