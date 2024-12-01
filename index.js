import { readFile } from "node:fs/promises";

import { diffArrays } from "diff";
import { PNG } from "pngjs";

const rasterize = async (png) => {
  const rasters = [];
  for (let y = 0; y < png.height; y++) {
    const raster = png.data.buffer.slice(
      y * png.width * 4,
      (y + 1) * png.width * 4
    );

    const hash = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", raster)),
    ]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    rasters.push(hash);
  }
  return rasters;
};

const diff = diffArrays(
  await rasterize(PNG.sync.read(await readFile("a.png"))),
  await rasterize(PNG.sync.read(await readFile("b.png")))
);

for (const { value, added, removed } of diff) {
  for (const raster of value) {
    const blank = " ".repeat(raster.length);
    const oldRaster = added ? blank : raster;
    const newRaster = removed ? blank : raster;
    console.log(`${oldRaster} ${newRaster}`);
  }
}
