#! /usr/bin/env node
import { Buffer } from "node:buffer";
import { readFile, writeFile } from "node:fs/promises";
import { diffArrays } from "diff";
import { PNG } from "pngjs";
const mixColor = (target, index, [r, g, b, a], ratio) => {
    target[index + 0] = Math.round(target[index + 0] * (1 - ratio) + r * ratio);
    target[index + 1] = Math.round(target[index + 1] * (1 - ratio) + g * ratio);
    target[index + 2] = Math.round(target[index + 2] * (1 - ratio) + b * ratio);
    target[index + 3] = Math.round(target[index + 3] * (1 - ratio) + a * ratio);
};
const rasterize = async (png) => {
    const rasters = [];
    for (let y = 0; y < png.height; y++) {
        const original = png.data.subarray(y * png.width * 4, (y + 1) * png.width * 4);
        const pixels = runLengthPixelize(original);
        const trimmed = original.subarray(Number(pixels.at(0)?.split(",")[0]) * 4, -Number(pixels.at(-1)?.split(",")[0]) * 4);
        rasters.push({ original, trimmed });
    }
    return rasters;
};
const runLengthPixelize = (raster) => {
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
        }
        else {
            count++;
        }
    }
    pixels.push(`${count},${current}`);
    return pixels;
};
const [, , oldPath, newPath, diffPath] = process.argv;
if (!oldPath || !newPath || !diffPath) {
    console.error("Usage: rastermatch old.png new.png output.png");
    process.exit(1);
}
const oldPNG = PNG.sync.read(await readFile(oldPath));
const newPNG = PNG.sync.read(await readFile(newPath));
const diff = diffArrays(await rasterize(oldPNG), await rasterize(newPNG), {
    comparator: (left, right) => left.trimmed.equals(right.trimmed),
});
const diffPNG = new PNG({
    width: Math.max(oldPNG.width, newPNG.width),
    height: diff.reduce((sum, { value }) => sum + value.length, 0),
});
let diffY = 0;
for (const { value, added, removed } of diff) {
    for (const raster of value) {
        const coloredRaster = Buffer.from(raster.original);
        for (let rasterIndex = 0; rasterIndex < coloredRaster.length; rasterIndex += 4) {
            if (added) {
                mixColor(coloredRaster, rasterIndex, [34, 220, 71, 255], 0.125);
            }
            else if (removed) {
                mixColor(coloredRaster, rasterIndex, [255, 12, 0, 255], 0.125);
            }
        }
        coloredRaster.copy(diffPNG.data, diffY * diffPNG.width * 4);
        diffY++;
    }
}
await writeFile(diffPath, PNG.sync.write(diffPNG));
