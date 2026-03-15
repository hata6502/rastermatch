import { diffArrays } from "diff";

export interface Raster {
  original: Uint8ClampedArray;
  hash: string;
}

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

    rasters.push({ original, hash });
  }

  const duplicatedHashes = [];
  let duplicated = false;
  let ignoreRasterCount = 0;
  for (let rasterIndex = 0; rasterIndex < rasters.length - 1; rasterIndex++) {
    const hash = rasters[rasterIndex].hash;

    if (!duplicated) {
      if (hash === rasters[rasterIndex + 1].hash) {
        duplicated = true;
      } else {
        duplicatedHashes.push(rasters[rasterIndex].hash);
        ignoreRasterCount++;
      }
    }

    if (duplicated) {
      ignoreRasterCount--;
      if (ignoreRasterCount >= 0) {
        rasters[rasterIndex].hash = [
          ...new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(duplicatedHashes.join("-")),
            ),
          ),
        ]
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("");
      }

      if (hash !== rasters[rasterIndex + 1].hash) {
        duplicatedHashes.splice(0);
        duplicated = false;
        ignoreRasterCount = 0;
      }
    }
  }

  return rasters;
};

export async function* generateDiffImages(
  oldRasters: Raster[],
  newRasters: Raster[],
) {
  for (const diff of diffRasters(oldRasters, newRasters)) {
    const rasterDiff = [];
    for (let changeIndex = 0; changeIndex < diff.length; changeIndex++) {
      const change = diff[changeIndex];
      const nextChange = diff.at(changeIndex + 1);

      if (change.removed && nextChange?.added) {
        const intersectedLength = Math.min(
          change.value.length,
          nextChange.value.length,
        );

        rasterDiff.push({
          type: "removed",
          value: change.value.slice(0, change.value.length - intersectedLength),
        } as const);
        rasterDiff.push({
          type: "changed",
          old: change.value.slice(change.value.length - intersectedLength),
          new: nextChange.value.slice(0, intersectedLength),
        } as const);
        rasterDiff.push({
          type: "added",
          value: nextChange.value.slice(intersectedLength),
        } as const);

        changeIndex++;
        continue;
      }

      rasterDiff.push({
        type: change.added ? "added" : change.removed ? "removed" : "unchanged",
        value: change.value,
      } as const);
    }

    const width = rasterDiff
      .flatMap((change) => {
        const changeType = change.type;
        switch (changeType) {
          case "added":
          case "removed":
          case "unchanged": {
            return change.value;
          }

          case "changed": {
            return [...change.old, ...change.new];
          }

          default: {
            throw new Error(`Unknown change: ${changeType satisfies never}`);
          }
        }
      })
      .reduce((max, raster) => Math.max(max, raster.original.length / 4), 0);
    const height = rasterDiff.reduce((sum, change) => {
      const changeType = change.type;
      switch (changeType) {
        case "added":
        case "removed":
        case "unchanged": {
          return sum + change.value.length;
        }

        case "changed": {
          return sum + change.old.length + change.new.length;
        }

        default: {
          throw new Error(`Unknown change: ${changeType satisfies never}`);
        }
      }
    }, 0);

    const data = new Uint8ClampedArray(width * height * 4);
    let y = 0;
    for (const change of rasterDiff) {
      const changeType = change.type;
      switch (changeType) {
        case "added":
        case "removed":
        case "unchanged": {
          for (const raster of change.value) {
            for (
              let dataIndex = 0;
              dataIndex < raster.original.length;
              dataIndex += 4
            ) {
              const ratio = {
                added: 0.125,
                removed: 0.125,
                unchanged: 0,
              }[changeType];
              const additive = {
                added: [34, 220, 71, 255],
                removed: [255, 12, 0, 255],
                unchanged: [0, 0, 0, 0],
              }[changeType];

              data.set(
                [
                  raster.original[dataIndex + 0] * (1 - ratio) +
                    additive[0] * ratio,
                  raster.original[dataIndex + 1] * (1 - ratio) +
                    additive[1] * ratio,
                  raster.original[dataIndex + 2] * (1 - ratio) +
                    additive[2] * ratio,
                  raster.original[dataIndex + 3] * (1 - ratio) +
                    additive[3] * ratio,
                ],
                y * width * 4 + dataIndex,
              );
            }

            y++;
          }

          break;
        }

        case "changed": {
          let oldX = 0;
          let newX = 0;
          for (const verticalDiff of diffRasters(
            await rasterize(transposeRasters(change.old)),
            await rasterize(transposeRasters(change.new)),
          )) {
            for (const verticalChange of verticalDiff) {
              if (verticalChange.removed) {
                for (const verticalRaster of verticalChange.value) {
                  for (
                    let dataIndex = 0;
                    dataIndex < verticalRaster.original.length;
                    dataIndex += 4
                  ) {
                    const ratio = 0.125;
                    const additive = [255, 12, 0, 255];

                    data.set(
                      [
                        verticalRaster.original[dataIndex + 0] * (1 - ratio) +
                          additive[0] * ratio,
                        verticalRaster.original[dataIndex + 1] * (1 - ratio) +
                          additive[1] * ratio,
                        verticalRaster.original[dataIndex + 2] * (1 - ratio) +
                          additive[2] * ratio,
                        verticalRaster.original[dataIndex + 3] * (1 - ratio) +
                          additive[3] * ratio,
                      ],
                      (y * width + oldX) * 4 + dataIndex * width,
                    );
                  }

                  oldX++;
                }

                continue;
              }

              for (const verticalRaster of verticalChange.value) {
                for (
                  let dataIndex = 0;
                  dataIndex < verticalRaster.original.length;
                  dataIndex += 4
                ) {
                  const ratio = verticalChange.added ? 0.125 : 0;
                  const additive = [34, 220, 71, 255];

                  data.set(
                    [
                      verticalRaster.original[dataIndex + 0] * (1 - ratio) +
                        additive[0] * ratio,
                      verticalRaster.original[dataIndex + 1] * (1 - ratio) +
                        additive[1] * ratio,
                      verticalRaster.original[dataIndex + 2] * (1 - ratio) +
                        additive[2] * ratio,
                      verticalRaster.original[dataIndex + 3] * (1 - ratio) +
                        additive[3] * ratio,
                    ],
                    ((y + change.old.length) * width + newX) * 4 +
                      dataIndex * width,
                  );
                }

                if (!verticalChange.added) {
                  oldX++;
                }
                newX++;
              }
            }
          }

          y += change.old.length + change.new.length;
          break;
        }

        default: {
          throw new Error(`Unknown change: ${changeType satisfies never}`);
        }
      }
    }

    yield { width, height, data };
  }
}

function* diffRasters(oldRasters: Raster[], newRasters: Raster[]) {
  const chunkSize = 8192;
  for (
    let chunkIndex = 0;
    chunkIndex < Math.max(oldRasters.length, newRasters.length);
    chunkIndex += chunkSize
  ) {
    yield diffArrays(
      oldRasters.slice(chunkIndex, chunkIndex + chunkSize),
      newRasters.slice(chunkIndex, chunkIndex + chunkSize),
      {
        comparator: (left, right) => left.hash === right.hash,
      },
    );
  }
}

const transposeRasters = (rasters: Raster[]) => {
  const width = rasters.length;
  const height = rasters.reduce(
    (max, raster) => Math.max(max, raster.original.length / 4),
    0,
  );

  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data.set(
        [
          rasters[x].original[y * 4 + 0],
          rasters[x].original[y * 4 + 1],
          rasters[x].original[y * 4 + 2],
          rasters[x].original[y * 4 + 3],
        ],
        (y * width + x) * 4,
      );
    }
  }

  return { width, height, data };
};
