import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = join(repositoryRoot, 'public', 'ocr');
const coreSource = join(repositoryRoot, 'node_modules', 'tesseract.js-core');

await rm(outputRoot, { force: true, recursive: true });
await mkdir(join(outputRoot, 'core'), { recursive: true });
await mkdir(join(outputRoot, 'lang'), { recursive: true });

await copyFile(
  join(repositoryRoot, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js'),
  join(outputRoot, 'worker.min.js'),
);
await copyFile(
  join(
    repositoryRoot,
    'node_modules',
    '@tesseract.js-data',
    'eng',
    '4.0.0_best_int',
    'eng.traineddata.gz',
  ),
  join(outputRoot, 'lang', 'eng.traineddata.gz'),
);

const coreFiles = (await readdir(coreSource)).filter((name) =>
  /^tesseract-core(?:-[a-z]+(?:-[a-z]+)?)?\.wasm\.js$/.test(name),
);

await Promise.all(
  coreFiles.map((name) => copyFile(join(coreSource, name), join(outputRoot, 'core', name))),
);
