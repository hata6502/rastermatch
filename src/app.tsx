import "./clarity.js";

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
import { useLanguage } from "react-controlled-translation";
import { createRoot } from "react-dom/client";

import { Raster, diffRasters, generateDiffImage, rasterize } from "./index.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = "pdf.worker.min.mjs";

const availableLangs = ["en", "ja"];
const messages = {
  "faq.oil-pixel": {
    en: "Oil Pixel Art Maker",
    ja: "油彩ドット絵メーカー",
  },
  "faq.almap": {
    en: "Photo Map",
    ja: "写真地図",
  },
  "faq.development": {
    en: "Development room",
    ja: "開発室",
  },
  description: {
    en: "Line-by-line image diff tool for comparing documents",
    ja: "ドキュメントを比較したいときに使う、行単位の画像diffツール",
  },
  offline: {
    en: "Compare in your browser without uploading files",
    ja: "ファイルをアップロードせずに、ブラウザ上で比較できます",
  },
  input: {
    en: "Please select PDF or image files",
    ja: "PDFや画像を選択してください",
  },
  hata6502: {
    en: "hata6502",
    ja: "ムギュウ",
  },
  disclaimer: {
    en: "Disclaimer",
    ja: "免責事項",
  },
};

const t = (key: keyof typeof messages) => {
  const lang = location.pathname.split("/").at(1) ?? "";
  const value = new Map(Object.entries(messages[key]));
  return value.get(lang) ?? value.get("en");
};

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
    title: t("faq.oil-pixel"),
    url: "https://oil-pixel.hata6502.com/",
  },
  {
    title: t("faq.almap"),
    url: "https://almap.hata6502.com/",
  },
  {
    title: t("faq.development"),
    url: "https://scrapbox.io/hata6502/rastermatch",
  },
];

export const App: FunctionComponent = () => {
  const translationLang = useLanguage();
  if (availableLangs.includes(translationLang)) {
    const paths = location.pathname.split("/");

    if (availableLangs.includes(paths.at(1) ?? "")) {
      paths.splice(1, 1);
    }

    if (translationLang !== "en") {
      paths.splice(1, 0, translationLang);
    }

    const newPath = paths.join("/");
    if (newPath !== location.pathname) {
      location.pathname = newPath;
    }
  }

  const [oldRasters, setOldRasters] = useState<Raster[]>([]);
  const [newRasters, setNewRasters] = useState<Raster[]>([]);

  const canvasGroupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasGroupRef.current) {
      return;
    }
    const canvasGroup = canvasGroupRef.current;

    const diff = diffRasters(oldRasters, newRasters);
    const diffImage = generateDiffImage(diff);
    if (!diffImage.width || !diffImage.height) {
      return;
    }

    canvasGroup.replaceChildren();
    // https://developer.mozilla.org/ja/docs/Web/HTML/Element/canvas#%E3%82%AD%E3%83%A3%E3%83%B3%E3%83%90%E3%82%B9%E3%81%AE%E6%9C%80%E5%A4%A7%E5%AF%B8%E6%B3%95
    const chunkHeight = Math.min(
      32767,
      Math.floor(268435456 / diffImage.width)
    );
    for (let chunkY = 0; chunkY < diffImage.height; chunkY += chunkHeight) {
      const chunkCanvas = document.createElement("canvas");
      chunkCanvas.width = diffImage.width;
      chunkCanvas.height = Math.min(chunkHeight, diffImage.height - chunkY);
      chunkCanvas.classList.add("block", "max-w-full");
      const chunkCanvasContext = chunkCanvas.getContext("2d");
      if (!chunkCanvasContext) {
        throw new Error("context is null");
      }

      chunkCanvasContext.putImageData(
        new ImageData(
          diffImage.data.slice(
            chunkY * chunkCanvas.width * 4,
            (chunkY + chunkCanvas.height) * chunkCanvas.width * 4
          ),
          chunkCanvas.width,
          chunkCanvas.height
        ),
        0,
        0
      );

      canvasGroup.append(chunkCanvas);
    }
  }, [oldRasters, newRasters]);

  const handleOldChange: ChangeEventHandler<HTMLInputElement> = async (
    event
  ) => {
    setOldRasters(await getRasters(event.target.files));
  };

  const handleNewChange: ChangeEventHandler<HTMLInputElement> = async (
    event
  ) => {
    setNewRasters(await getRasters(event.target.files));
  };

  return (
    <div className="bg-white mx-auto max-w-4xl mb-16 px-8">
      <div className="mt-16">
        <h2 className="flex flex-col-reverse items-center gap-4 break-keep break-words font-bold text-5xl md:flex-row">
          Hemming Diff
          <img src="/favicon.png" className="inline w-20" />
        </h2>

        <p className="mt-8">
          {t("description")}
          <br />
          {t("offline")}
        </p>

        <div className="mt-16">
          <div>{t("input")}</div>

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

        <div ref={canvasGroupRef} className="mt-8" />

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
              {t("hata6502")}
            </a>
            &emsp;
            <a
              href="https://scrapbox.io/hata6502/Hemming_Diff%E5%85%8D%E8%B2%AC%E4%BA%8B%E9%A0%85"
              target="_blank"
              className="hover:text-gray-600"
            >
              {t("disclaimer")}
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
            canvasContext.getImageData(0, 0, canvas.width, canvas.height)
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
          canvasContext.getImageData(0, 0, canvas.width, canvas.height)
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
