import { ArrayChange } from "diff";
export interface Raster {
    original: Uint8ClampedArray;
    hash: string;
}
export declare const diffRasters: (oldRasters: Raster[], newRasters: Raster[]) => ArrayChange<Raster>[];
export declare const rasterize: (image: {
    width: number;
    height: number;
    data: Uint8ClampedArray;
}) => Promise<Raster[]>;
export declare const generateDiffImage: (diff: ArrayChange<Raster>[]) => {
    width: number;
    height: number;
    data: Uint8ClampedArray<ArrayBuffer>;
};
