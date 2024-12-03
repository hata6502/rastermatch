#! /usr/bin/env node
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
        const original = [
            ...png.data.subarray(y * png.width * 4, (y + 1) * png.width * 4),
        ];
        let start = 0;
        while (start < original.length) {
            if (original[start + 0] !== original[0] ||
                original[start + 1] !== original[1] ||
                original[start + 2] !== original[2] ||
                original[start + 3] !== original[3]) {
                break;
            }
            start += 4;
        }
        let end = original.length;
        while (end >= 0) {
            end -= 4;
            if (original[end + 0] !== original[original.length - 4] ||
                original[end + 1] !== original[original.length - 3] ||
                original[end + 2] !== original[original.length - 2] ||
                original[end + 3] !== original[original.length - 1]) {
                break;
            }
        }
        const trimmed = original.slice(start, end);
        const hash = [
            ...new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(trimmed))),
        ]
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
        rasters.push({ original, hash });
    }
    return rasters;
};
const [, , oldPath, newPath, diffPath] = process.argv;
if (!oldPath || !newPath || !diffPath) {
    console.error("Usage: rastermatch old.png new.png output.png");
    process.exit(1);
}
const oldPNG = PNG.sync.read(await readFile(oldPath));
const newPNG = PNG.sync.read(await readFile(newPath));
const diff = diffArrays(await rasterize(oldPNG), await rasterize(newPNG), {
    comparator: (left, right) => left.hash === right.hash,
});
const diffPNG = new PNG({
    width: Math.max(oldPNG.width, newPNG.width),
    height: diff.reduce((sum, { value }) => sum + value.length, 0),
});
let diffY = 0;
for (const { value, added, removed } of diff) {
    for (const raster of value) {
        const coloredRaster = [...raster.original];
        for (let rasterIndex = 0; rasterIndex < coloredRaster.length; rasterIndex += 4) {
            if (added) {
                mixColor(coloredRaster, rasterIndex, [34, 220, 71, 255], 0.125);
            }
            else if (removed) {
                mixColor(coloredRaster, rasterIndex, [255, 12, 0, 255], 0.125);
            }
        }
        diffPNG.data.set(coloredRaster, diffY * diffPNG.width * 4);
        diffY++;
    }
}
await writeFile(diffPath, PNG.sync.write(diffPNG));
