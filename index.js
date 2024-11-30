import { readFile, writeFile } from "node:fs/promises";

import { PNG } from "pngjs";
//import pixelmatch from "pixelmatch";

/*const match = (a, b) => {
  const width = Math.max(a.width, b.width);
  const height = Math.max(a.height, b.height);

  const extendedA = new PNG({ width, height });
  putImageData(extendedA, a);
  const extendedB = new PNG({ width, height });
  putImageData(extendedB, b);

  const mismatchedCount = pixelmatch(
    extendedA.data,
    extendedB.data,
    // diff.data,
    null,
    width,
    height
  );
  return mismatchedCount;
};*/
/*const linematch = (a, b) => {
  const width = Math.max(a.width, b.width);
  const height = Math.max(a.height, b.height);

  const extendedA = new PNG({ width, height });
  putImageData(extendedA, a);
  const extendedB = new PNG({ width, height });
  putImageData(extendedB, b);

  const mismatchedCount = pixelmatch(
    extendedA.data,
    extendedB.data,
    null,
    width,
    height,
    { threshold: 0.1, includeAA: true, alpha: 0.1 }
  );
  return mismatchedCount;
};*/

const putImageData = (target, source) => {
  for (let y = 0; y < source.height; y++) {
    source.data.copy(
      target.data,
      y * target.width * 4,
      y * source.width * 4,
      (y + 1) * source.width * 4
    );
  }
};

const a = PNG.sync.read(await readFile("a.png"));
const b = PNG.sync.read(await readFile("b.png"));

/*const hems = [];
let currentY = 0;
let currentLine = Buffer.from(
  a.data.buffer,
  0,
  a.width * 4
);
for (let y = 1; y < a.height; y++) {
  const line = Buffer.from(a.data.buffer, y * a.width * 4, a.width * 4);
  if (!line.equals(currentLine)) {
    hems.push({ start: currentY, end: y });
    currentY = y;
    currentLine = line;
  }
}
hems.push({ start: currentY, end: a.height });*/

/*console.log(
  "hems",
  hems
    .map((hem) => ({ ...hem, width: hem.end - hem.start }))
    .toSorted((a, b) => b.width - a.width)
);*/

if (a.width !== b.width) {
  throw new Error("width mismatch");
}

let currentMismatchedCount = match(a, b);
for (let y = 0; y < a.height; ) {
  const hemmedA = new PNG({ width: a.width, height: a.height });
  a.data.copy(hemmedA.data, 0, 0, y * a.width * 4);
  a.data.copy(
    hemmedA.data,
    y * hemmedA.width * 4,
    (y + 1) * a.width * 4,
    a.height * a.width * 4
  );

  const mismatchedCount = match(hemmedA, b);
  if (mismatchedCount < currentMismatchedCount) {
    a = hemmedA;
    currentMismatchedCount = mismatchedCount;
  } else {
    y++;
  }

  console.log("y", y, currentMismatchedCount);
}
