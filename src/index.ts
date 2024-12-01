import { Buffer } from "node:buffer";
import { readFile, writeFile } from "node:fs/promises";

import { diffArrays } from "diff";
import { PNG } from "pngjs";

const mixColor = (
  target: Buffer,
  index: number,
  [r, g, b, a]: [number, number, number, number],
  ratio: number
) => {
  target[index + 0] = Math.round(target[index + 0] * (1 - ratio) + r * ratio);
  target[index + 1] = Math.round(target[index + 1] * (1 - ratio) + g * ratio);
  target[index + 2] = Math.round(target[index + 2] * (1 - ratio) + b * ratio);
  target[index + 3] = Math.round(target[index + 3] * (1 - ratio) + a * ratio);
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

const diffPNG = new PNG({
  width: Math.max(oldPNG.width, newPNG.width),
  height: diff.reduce((sum, { value }) => sum + value.length, 0),
});
let diffY = 0;
for (const { value, added, removed } of diff) {
  for (const raster of value) {
    const coloredRaster = Buffer.from(raster);
    for (
      let rasterIndex = 0;
      rasterIndex < coloredRaster.length;
      rasterIndex += 4
    ) {
      if (added) {
        mixColor(coloredRaster, rasterIndex, [34, 220, 71, 255], 0.125);
      } else if (removed) {
        mixColor(coloredRaster, rasterIndex, [255, 12, 0, 255], 0.125);
      }
    }

    coloredRaster.copy(diffPNG.data, diffY * diffPNG.width * 4);
    diffY++;
  }
}
await writeFile("diff.png", PNG.sync.write(diffPNG));
