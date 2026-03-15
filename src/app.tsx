import "./clarity.js";

import { DocumentTextIcon } from "@heroicons/react/24/outline";
import * as pdfjsLib from "pdfjs-dist";
import {
  ChangeEventHandler,
  Fragment,
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
    englishTitle: "Japanese proofreading tool",
    japaneseTitle: "校正さん",
    url: "https://kohsei-san.hata6502.com/",
  },
  {
    englishTitle: "Accessible image embedding tool",
    japaneseTitle: "Mojimage - アクセシブル画像埋め込みツール",
    url: "https://mojimage.hata6502.com/",
  },
];

const displayConfigs: Record<
  string,
  {
    pageTitle: string;
    heading: string;
    descriptionLines: string[];
    filePrompt: string;
  }
> = {
  default: {
    pageTitle: "Raster Diff",
    heading: "Raster Diff",
    descriptionLines: [
      "Line-by-line image diff tool for comparing documents",
      "Compare in your browser without uploading files",
    ],
    filePrompt: "Please select PDF or image files",
  },
  pdf: {
    pageTitle: "オフラインPDF差分比較ツール",
    heading: "オフラインPDF差分比較ツール",
    descriptionLines: [
      "PDFの差分を行単位の画像比較で確認できます",
      "ファイルをアップロードせず、ブラウザだけで比較できます",
    ],
    filePrompt: "比較するPDFファイルを選択してください",
  },
  screenshot: {
    pageTitle: "スクリーンショット差分比較ツール",
    heading: "スクリーンショット差分比較ツール",
    descriptionLines: [
      "スクリーンショットや画像の差分を行単位で比較できます",
      "ファイルをアップロードせず、ブラウザだけで比較できます",
    ],
    filePrompt: "比較するスクリーンショット画像を選択してください",
  },
};

export const App: FunctionComponent = () => {
  const [oldRasters, setOldRasters] = useState<Raster[]>([]);
  const [newRasters, setNewRasters] = useState<Raster[]>([]);

  const imageGroupRef = useRef<HTMLDivElement>(null);
  const display =
    new URLSearchParams(window.location.search).get("display") ?? "default";
  const displayConfig = displayConfigs[display];
  const faqTitleKey = display === "default" ? "englishTitle" : "japaneseTitle";
  const heading =
    display === "pdf" ? (
      <>
        オフライン
        <wbr />
        PDF
        <wbr />
        差分比較ツール
      </>
    ) : display === "screenshot" ? (
      <>
        スクリーン
        <wbr />
        ショット
        <wbr />
        差分比較ツール
      </>
    ) : (
      displayConfig.heading
    );

  useEffect(() => {
    document.title = displayConfig.pageTitle;
  }, [displayConfig]);

  useEffect(() => {
    const abortController = new AbortController();
    (async () => {
      if (!imageGroupRef.current) {
        return;
      }
      const imageGroup = imageGroupRef.current;

      const diffWidth = [...oldRasters, ...newRasters].reduce(
        (max, raster) => Math.max(max, raster.original.length / 4),
        0,
      );
      imageGroup.replaceChildren();
      for await (const diff of diffRasters(oldRasters, newRasters)) {
        const diffImage = await generateDiffImage(diff, diffWidth);
        if (!diffImage.width || !diffImage.height) {
          continue;
        }
        if (abortController.signal.aborted) {
          return;
        }

        // https://developer.mozilla.org/ja/docs/Web/HTML/Element/canvas#%E3%82%AD%E3%83%A3%E3%83%B3%E3%83%90%E3%82%B9%E3%81%AE%E6%9C%80%E5%A4%A7%E5%AF%B8%E6%B3%95
        const chunkHeight = Math.max(
          1,
          Math.min(32767, Math.floor(268435456 / diffImage.width)),
        );
        for (
          let chunkY = 0;
          chunkY < diffImage.height;
          chunkY += chunkHeight
        ) {
          const chunkCanvas = document.createElement("canvas");
          chunkCanvas.width = diffImage.width;
          chunkCanvas.height = Math.min(chunkHeight, diffImage.height - chunkY);
          const chunkCanvasContext = chunkCanvas.getContext("2d");
          if (!chunkCanvasContext) {
            throw new Error("context is null");
          }

          chunkCanvasContext.putImageData(
            new ImageData(
              diffImage.data.slice(
                chunkY * chunkCanvas.width * 4,
                (chunkY + chunkCanvas.height) * chunkCanvas.width * 4,
              ),
              chunkCanvas.width,
              chunkCanvas.height,
            ),
            0,
            0,
          );

          const chunkBlob = await new Promise<Blob>((resolve, reject) => {
            chunkCanvas.toBlob((blob) => {
              if (!blob) {
                reject(new Error("blob is null"));
                return;
              }

              resolve(blob);
            }, "image/png");
          });

          if (abortController.signal.aborted) {
            return;
          }
          const chunkImage = document.createElement("img");
          chunkImage.src = URL.createObjectURL(chunkBlob);
          chunkImage.classList.add("block");
          imageGroup.append(chunkImage);
        }
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [oldRasters, newRasters]);

  const handleOldChange: ChangeEventHandler<HTMLInputElement> = async (
    event,
  ) => {
    setOldRasters(await getRasters(event.target.files));
  };

  const handleNewChange: ChangeEventHandler<HTMLInputElement> = async (
    event,
  ) => {
    setNewRasters(await getRasters(event.target.files));
  };

  return (
    <div className="bg-white mx-auto max-w-4xl mb-16 px-8">
      <div className="mt-16">
        <h2 className="flex flex-col-reverse items-center gap-4 break-keep break-words font-bold text-5xl md:flex-row">
          <span className="text-center md:text-left">{heading}</span>
          <img src="/favicon.png" className="inline w-20" />
        </h2>

        <p className="mt-8">
          {displayConfig.descriptionLines.map((line, index) => (
            <Fragment key={`${index}-${line}`}>
              {index > 0 && <br />}
              {line}
            </Fragment>
          ))}
        </p>

        <div className="mt-16">
          <div>{displayConfig.filePrompt}</div>

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

        <div ref={imageGroupRef} className="mt-8" />

        <div className="mt-16">
          <div className="divide-y divide-gray-900/10">
            {faqs.map((faq) => (
              <a
                key={faq.url}
                href={faq.url}
                target="_blank"
                className="flex items-center gap-x-2 py-6"
              >
                <DocumentTextIcon className="h-6 w-6" aria-hidden="true" />
                <span className="font-semibold leading-7">
                  {faq[faqTitleKey]}
                </span>
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
              hata6502
            </a>
            &emsp;
            <a
              href="https://scrapbox.io/hata6502/Raster_Diff%E5%85%8D%E8%B2%AC%E4%BA%8B%E9%A0%85"
              target="_blank"
              className="hover:text-gray-600"
            >
              Disclaimer
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
};

const getRasters = async (files: FileList | null) => {
  const imageDataList = [];
  for (const file of files ?? []) {
    switch (file.type) {
      case "application/pdf": {
        const pdf = await pdfjsLib.getDocument(await file.arrayBuffer())
          .promise;

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          console.log("getRasters", file.name, pageNumber);
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
            canvasContext.getImageData(0, 0, canvas.width, canvas.height),
          );
        }
        break;
      }

      default: {
        console.log("getRasters", file.name);
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
          canvasContext.getImageData(0, 0, canvas.width, canvas.height),
        );
        break;
      }
    }
  }

  const rasters = [];
  for (const [imageDataIndex, imageData] of imageDataList.entries()) {
    console.log("rasterize", imageDataIndex);
    const chunkRasters = await rasterize({
      width: imageData.width,
      height: imageData.height,
      data: imageData.data,
    });
    rasters.push(...chunkRasters);
  }
  return rasters;
};
