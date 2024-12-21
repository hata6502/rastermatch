import { diffArrays } from "diff";
export const diffRasters = (oldRasters, newRasters) => {
    const chunkSize = 8192;
    const chunks = [];
    for (let chunkIndex = 0; chunkIndex < Math.max(oldRasters.length, newRasters.length); chunkIndex += chunkSize) {
        chunks.push({
            oldChunk: oldRasters.slice(chunkIndex, chunkIndex + chunkSize),
            newChunk: newRasters.slice(chunkIndex, chunkIndex + chunkSize),
        });
    }
    return chunks.flatMap(({ oldChunk, newChunk }, chunkIndex) => {
        console.log("rastermatch", chunkIndex);
        return diffArrays(oldChunk, newChunk, {
            comparator: (left, right) => left.hash === right.hash,
        });
    });
};
export const rasterize = async (image) => {
    const rasters = [];
    for (let y = 0; y < image.height; y++) {
        const original = image.data.slice(y * image.width * 4, (y + 1) * image.width * 4);
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
        const raster = { original, hash };
        rasters.push(raster);
    }
    return rasters;
};
export const generateDiffImage = (diff) => {
    const width = diff
        .flatMap(({ value }) => value.flatMap((raster) => raster.original.length))
        .reduce((max, length) => Math.max(max, length), 0) / 4;
    const height = diff.reduce((sum, { value }) => sum + value.length, 0);
    const data = new Uint8ClampedArray(width * height * 4);
    let y = 0;
    for (const { value, added, removed } of diff) {
        for (const raster of value) {
            const coloredRaster = new Uint8ClampedArray(raster.original);
            for (let rasterIndex = 0; rasterIndex < coloredRaster.length; rasterIndex += 4) {
                if (added) {
                    mixColor(coloredRaster, rasterIndex, [34, 220, 71, 255], 0.125);
                }
                else if (removed) {
                    mixColor(coloredRaster, rasterIndex, [255, 12, 0, 255], 0.125);
                }
            }
            data.set(coloredRaster, y * width * 4);
            y++;
        }
    }
    return { width, height, data };
};
const mixColor = (target, index, [r, g, b, a], ratio) => {
    target[index + 0] = Math.round(target[index + 0] * (1 - ratio) + r * ratio);
    target[index + 1] = Math.round(target[index + 1] * (1 - ratio) + g * ratio);
    target[index + 2] = Math.round(target[index + 2] * (1 - ratio) + b * ratio);
    target[index + 3] = Math.round(target[index + 3] * (1 - ratio) + a * ratio);
};
