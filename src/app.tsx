import "./clarity";

import { DocumentTextIcon } from "@heroicons/react/24/outline";
import * as pdfjsLib from "pdfjs-dist";
import {
  ChangeEventHandler,
  FunctionComponent,
  StrictMode,
  useEffect,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";

import { Raster, diffRasters, generateDiffImage, rasterize } from "./index.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = "pdf.worker.min.mjs";

const Index: FunctionComponent = () => (
  <StrictMode>
    <App />
  </StrictMode>
);
const container = document.createElement("div");
document.body.append(container);
createRoot(container).render(<Index />);

const faqs = [
  {
    title: "油彩ドット絵メーカー",
    url: "https://oil-pixel.hata6502.com/",
  },
  {
    title: "写真地図",
    url: "https://almap.hata6502.com/",
  },
  {
    title: "開発室",
    url: "https://scrapbox.io/hata6502/rastermatch",
  },
];

export const App: FunctionComponent = () => {
  const [oldRasters, setOldRasters] = useState<Raster[]>([]);
  const [newRasters, setNewRasters] = useState<Raster[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }
    const canvas = canvasRef.current;

    const diff = diffRasters(oldRasters, newRasters);
    const diffImage = generateDiffImage(diff);
    if (!diffImage.width || !diffImage.height) {
      return;
    }

    canvas.width = diffImage.width;
    canvas.height = diffImage.height;
    canvas.hidden = false;
    const canvasContext = canvas.getContext("2d");
    if (!canvasContext) {
      throw new Error("context is null");
    }
    canvasContext.putImageData(
      new ImageData(diffImage.data, diffImage.width, diffImage.height),
      0,
      0
    );
  }, [oldRasters, newRasters]);

  const handleOldChange: ChangeEventHandler<HTMLInputElement> = async (
    event
  ) => {
    const imageData = await getImageData(event.target.files);
    setOldRasters(
      await rasterize({
        width: imageData.width,
        height: imageData.height,
        data: imageData.data,
      })
    );
  };

  const handleNewChange: ChangeEventHandler<HTMLInputElement> = async (
    event
  ) => {
    const imageData = await getImageData(event.target.files);
    setNewRasters(
      await rasterize({
        width: imageData.width,
        height: imageData.height,
        data: imageData.data,
      })
    );
  };

  return (
    <div className="bg-white mx-auto max-w-4xl mb-16 px-8">
      <div className="mt-16">
        <h2 className="flex flex-col-reverse items-center gap-4 break-keep break-words font-bold text-5xl md:flex-row">
          Hemming Diff
          <img src="favicon.png" className="inline w-20" />
        </h2>

        <p className="mt-8">
          ドキュメントを比較したいときに使う、行単位の画像diffツール
          <br />
          ファイルをアップロードせずに、ブラウザ上で比較できます
        </p>

        <div className="mt-16">
          <div>比較したいPDFや画像を選択してください</div>

          <div className="mt-8">
            <input
              type="file"
              accept="application/pdf, image/*"
              multiple
              onChange={handleOldChange}
              style={{
                background: "rgb(255 12 0 / 12.5%)",
              }}
            />

            <input
              type="file"
              accept="application/pdf, image/*"
              multiple
              onChange={handleNewChange}
              style={{
                background: "rgb(34 220 71 / 12.5%)",
              }}
            />
          </div>
        </div>

        <div className="mt-8">
          <canvas ref={canvasRef} hidden className="w-full" />
        </div>

        <div className="mt-16">
          <div className="divide-y divide-gray-900/10">
            {faqs.map(({ title, url }) => (
              <a
                key={title}
                href={url}
                target="_blank"
                className="flex items-center gap-x-2 py-6"
              >
                <DocumentTextIcon className="h-6 w-6" aria-hidden="true" />
                <span className="font-semibold leading-7">{title}</span>
              </a>
            ))}
          </div>
        </div>

        <footer className="mt-16">
          <p className="text-xs leading-5 text-gray-500">
            {new Date().getFullYear()}
            &nbsp;
            <a
              href="https://twitter.com/hata6502"
              target="_blank"
              className="hover:text-gray-600"
            >
              ムギュウ
            </a>
            &emsp;
            <a
              href="https://scrapbox.io/hata6502/Hemming_Diff%E5%85%8D%E8%B2%AC%E4%BA%8B%E9%A0%85"
              target="_blank"
              className="hover:text-gray-600"
            >
              免責事項
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
};

const getImageData = async (files: FileList | null) => {
  const imageDataList = [];
  for (const file of files ?? []) {
    switch (file.type) {
      case "application/pdf": {
        const pdf = await pdfjsLib.getDocument(await file.arrayBuffer())
          .promise;

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: devicePixelRatio });

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const canvasContext = canvas.getContext("2d");
          if (!canvasContext) {
            throw new Error("context is null");
          }

          await page.render({ canvasContext, viewport }).promise;
          imageDataList.push(
            canvasContext.getImageData(0, 0, canvas.width, canvas.height)
          );
        }
        break;
      }

      default: {
        const imageBitmap = await createImageBitmap(file);
        const canvas = document.createElement("canvas");
        canvas.width = imageBitmap.width;
        canvas.height = imageBitmap.height;
        const canvasContext = canvas.getContext("2d");
        if (!canvasContext) {
          throw new Error("context is null");
        }
        canvasContext.drawImage(imageBitmap, 0, 0);
        imageDataList.push(
          canvasContext.getImageData(0, 0, canvas.width, canvas.height)
        );
        break;
      }
    }
  }

  const concatedCanvas = document.createElement("canvas");
  concatedCanvas.width = imageDataList.reduce(
    (max, imageData) => Math.max(max, imageData.width),
    0
  );
  concatedCanvas.height = imageDataList.reduce(
    (sum, imageData) => sum + imageData.height,
    0
  );
  const concatedCanvasContext = concatedCanvas.getContext("2d");
  if (!concatedCanvasContext) {
    throw new Error("context is null");
  }

  let concatedY = 0;
  for (const imageData of imageDataList) {
    concatedCanvasContext.putImageData(imageData, 0, concatedY);
    concatedY += imageData.height;
  }
  return concatedCanvasContext.getImageData(
    0,
    0,
    concatedCanvas.width,
    concatedCanvas.height
  );
};
