import { ArrayChange, diffArrays } from "diff";

export interface Raster {
  original: Uint8ClampedArray;
  hash: string;
  start: number;
  end: number;
}

export const diffRasters = (oldRasters: Raster[], newRasters: Raster[]) => {
  const chunkSize = 8192;
  const chunks = [];
  for (
    let chunkIndex = 0;
    chunkIndex < Math.max(oldRasters.length, newRasters.length);
    chunkIndex += chunkSize
  ) {
    chunks.push({
      oldChunk: oldRasters.slice(chunkIndex, chunkIndex + chunkSize),
      newChunk: newRasters.slice(chunkIndex, chunkIndex + chunkSize),
    });
  }

  return chunks.flatMap(({ oldChunk, newChunk }) =>
    diffArrays(oldChunk, newChunk, {
      comparator: (left, right) => left.hash === right.hash,
    }),
  );
};

export const rasterize = async (image: {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}) => {
  const rasters: Raster[] = [];
  for (let y = 0; y < image.height; y++) {
    const original = image.data.slice(
      y * image.width * 4,
      (y + 1) * image.width * 4,
    );

    let start = 0;
    while (start < original.length) {
      if (
        original[start + 0] !== original[0] ||
        original[start + 1] !== original[1] ||
        original[start + 2] !== original[2] ||
        original[start + 3] !== original[3]
      ) {
        break;
      }

      start += 4;
    }
    let end = original.length;
    while (end >= 0) {
      end -= 4;

      if (
        original[end + 0] !== original[original.length - 4] ||
        original[end + 1] !== original[original.length - 3] ||
        original[end + 2] !== original[original.length - 2] ||
        original[end + 3] !== original[original.length - 1]
      ) {
        break;
      }
    }

    const hash = [
      ...new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new Uint8Array(original.slice(start, end)),
        ),
      ),
    ]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    rasters.push({ original, hash, start, end });
  }
  return rasters;
};

const emptyRaster = {
  original: new Uint8ClampedArray(),
  hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  start: 0,
  end: 0,
};

export const generateDiffImage = (diff: ArrayChange<Raster>[]) => {
  const width =
    diff
      .flatMap(({ value }) => value.flatMap((raster) => raster.original.length))
      .reduce((max, length) => Math.max(max, length), 0) / 4;
  const height = diff.reduce((sum, { value }) => sum + value.length, 0);
  const data = new Uint8ClampedArray(width * height * 4);

  let y = 0;
  for (const [changeIndex, change] of diff.entries()) {
    const fromChange = getFromChange({ change, changeIndex, diff });

    for (const [rasterIndex, raster] of change.value.entries()) {
      const fromRaster = getFromRaster({ rasterIndex, fromChange, change });
      const groupedDataDiff = diffRaster(fromRaster, raster);

      let dataIndex = 0;
      for (const groupedDataChange of groupedDataDiff) {
        if (groupedDataChange.removed) {
          continue;
        }

        for (const groupedData of groupedDataChange.value) {
          const colorAdditive = getColorAdditive({
            dataIndex,
            groupedDataChange,
            raster,
            fromRaster,
            change,
          });

          data.set(
            [
              groupedData[0] * (1 - colorAdditive.ratio) +
                colorAdditive.color[0] * colorAdditive.ratio,
              groupedData[1] * (1 - colorAdditive.ratio) +
                colorAdditive.color[1] * colorAdditive.ratio,
              groupedData[2] * (1 - colorAdditive.ratio) +
                colorAdditive.color[2] * colorAdditive.ratio,
              groupedData[3] * (1 - colorAdditive.ratio) +
                colorAdditive.color[3] * colorAdditive.ratio,
            ],
            y * width * 4 + dataIndex,
          );

          dataIndex += 4;
        }
      }

      y++;
    }
  }

  return { width, height, data };
};

const getFromChange = ({
  change,
  changeIndex,
  diff,
}: {
  change: ArrayChange<Raster>;
  changeIndex: number;
  diff: ArrayChange<Raster>[];
}) => {
  if (change.added) {
    if (changeIndex <= 0) {
      return;
    }
    const fromChange = diff[changeIndex - 1];
    if (!fromChange.removed) {
      return;
    }
    return fromChange;
  } else if (change.removed) {
    if (changeIndex >= diff.length - 1) {
      return;
    }
    const fromChange = diff[changeIndex + 1];
    if (!fromChange.added) {
      return;
    }
    return fromChange;
  }
};

const getFromRaster = ({
  rasterIndex,
  fromChange,
  change,
}: {
  rasterIndex: number;
  fromChange?: ArrayChange<Raster>;
  change: ArrayChange<Raster>;
}) => {
  if (!fromChange) {
    return emptyRaster;
  }

  const fromRasterIndex =
    fromChange.value.length - change.value.length + rasterIndex;
  if (fromRasterIndex < 0 || fromRasterIndex >= fromChange.value.length) {
    return emptyRaster;
  }
  return fromChange.value[fromRasterIndex];
};

const diffRaster = (oldRaster: Raster, newRaster: Raster) => {
  const chunkSize = 8192 * 4;
  const chunks = [];
  for (
    let chunkIndex = 0;
    chunkIndex < Math.max(oldRaster.original.length, newRaster.original.length);
    chunkIndex += chunkSize
  ) {
    chunks.push({
      oldChunk: oldRaster.original.slice(chunkIndex, chunkIndex + chunkSize),
      newChunk: newRaster.original.slice(chunkIndex, chunkIndex + chunkSize),
    });
  }

  return chunks.flatMap(({ oldChunk, newChunk }) =>
    diffArrays(groupedData(oldChunk), groupedData(newChunk), {
      comparator: (left, right) =>
        left[0] === right[0] &&
        left[1] === right[1] &&
        left[2] === right[2] &&
        left[3] === right[3],
    }),
  );
};

const groupedData = (data: Uint8ClampedArray<ArrayBuffer>) => {
  const groupedData = [];
  for (let dataIndex = 0; dataIndex < data.length; dataIndex += 4) {
    groupedData.push(data.slice(dataIndex, dataIndex + 4));
  }
  return groupedData;
};

const getColorAdditive = ({
  dataIndex,
  groupedDataChange,
  raster,
  fromRaster,
  change,
}: {
  dataIndex: number;
  groupedDataChange: ArrayChange<Uint8ClampedArray>;
  raster: Raster;
  fromRaster: Raster;
  change: ArrayChange<Raster>;
}) => {
  const color = change.added ? [34, 220, 71, 255] : [255, 12, 0, 255];

  if (!change.added && !change.removed) {
    return { color, ratio: 0 };
  }

  if (fromRaster.hash === emptyRaster.hash) {
    return { color, ratio: 0.125 };
  }

  if (
    dataIndex >= raster.start &&
    dataIndex < raster.end &&
    groupedDataChange.added
  ) {
    return { color, ratio: 0.625 };
  }

  return change.removed
    ? { color: [0, 0, 0, 0], ratio: 1 }
    : { color, ratio: 0.125 };
};
