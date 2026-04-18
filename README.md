# rasterdiff

Raster Diff is a line-by-line image diff tool for documents.

Website: https://diff.hata6502.com/

The web app compares PDFs and images in the browser without uploading files.
The CLI currently supports PNG input and writes a single PNG diff image.

## CLI

```bash
rasterdiff before.png after.png output.png
```

Exit status:

- `0`: no diff
- `1`: diff found
- `2`: usage or runtime error

## Development

Build the CLI locally:

```bash
npm install
npm run build
```

Run it:

```bash
node dist/cli.js before.png after.png output.png
```
