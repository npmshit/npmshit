import rd from "rd/promises";
import rd2 from "rd";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const BLACK_LIST_FILE = [
  "license",
  "license.txt",
  "license-mit.txt",
  "author",
  "authors",
  "changelog",
  "changelogs",
  "history",
  "codeowners",

  "gulpfile.js",
  "bower.json",

  "tsconfig.json",

  "tslint.json",
  "tslint.yaml",

  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
];
const BLACK_LIST_EXT = [".md", ".markdown", ".map"];
const BLACK_LIST_ADVJS_EXT = [".min.js", ".test.js", ".spec.js", ".debug.js"];
const BLACK_LIST_DIR = [
  "example",
  "examples",
  "test",
  "tests",
  ".idea",
  ".vscode",
  "docs",
  "doc",
  "wiki",
  "__test__",
  "__mock__",
];
const BLACK_LIST_PACKAGE: Record<string, { dirs: string[]; files: string[] }> = {
  handlebars: {
    dirs: ["dist"],
    files: [],
  },
  typescript: {
    dirs: [],
    files: ["CopyrightNotice.txt", "ThirdPartyNoticeText.txt"],
  },
};
const WHITE_LIST_PACKAGE_FIELD = ["name", "version", "main", "scripts", "typings", "bin", "dependencies"];

export interface IResult {
  totalSize: number;
  size: number;
  packageFreeSize: number;
  packageCount: number;
  fileCount: number;
  fileList: Set<string>;
  dirList: Set<string>;
  packageFileList: Set<string>;
  removeFiles: Set<string>;
}

export type Callback = (err: Error | null, res: IResult) => void;

export const unlinkAsync = promisify(fs.unlink);
export const rmdirAsync = promisify(fs.rmdir);
export const statAsync = promisify(fs.stat);

export async function rmdir(dir: string) {
  const list = await rd.readDir(dir);
  list.sort((a, b) => b.length - a.length);
  for (const n of list) {
    try {
      await rmdirAsync(n);
    } catch (err) {}
  }
  try {
    await rmdirAsync(dir);
  } catch (err) {}
}

export function humanFileSize(size: number) {
  if (size < 1) return "0 B";
  var i = Math.floor(Math.log(size) / Math.log(1024));
  return (size / Math.pow(1024, i)).toFixed(2) + " " + ["B", "kB", "MB", "GB", "TB"][i];
}

export async function listFiles(base: string): Promise<IResult> {
  const res: IResult = {
    totalSize: 0,
    size: 0,
    packageFreeSize: 0,
    packageCount: 0,
    fileCount: 0,
    fileList: new Set(),
    dirList: new Set(),
    packageFileList: new Set(),
    removeFiles: new Set(),
  };

  function fileFiltter(name: string) {
    const file = path.basename(name).toLocaleLowerCase();
    if (file === "package.json") {
      res.packageCount += 1;
      res.packageFileList.add(name);
    }

    if (file[0] === ".") return true;

    if (BLACK_LIST_FILE.indexOf(file) !== -1) return true;

    const ext = path.extname(name).toLocaleLowerCase();
    if (BLACK_LIST_EXT.indexOf(ext) !== -1) return true;

    if (ext === ".js") {
      for (const advExt of BLACK_LIST_ADVJS_EXT) {
        if (file.slice(-advExt.length) === advExt) return true;
      }
    }
  }

  function dirFiltter(name: string) {
    const dir = path.basename(name).toLocaleLowerCase();
    if (BLACK_LIST_DIR.indexOf(dir) !== -1) res.dirList.add(name);
  }

  function process(name: string, stats: fs.Stats) {
    const file = path.basename(name).toLocaleLowerCase();
    if (file === "package.json") {
      const { size: newSize, removeFiles } = reducePackageJson(name);
      const size = stats.size - newSize;
      res.size += size;
      res.packageFreeSize += size;
      removeFiles.forEach(it => res.removeFiles.add(it));
    }
  }

  function findOne(filename: string, stats: fs.Stats, next: () => void) {
    res.totalSize += stats.size;
    process(filename, stats);
    if (stats.isFile() && !fileFiltter(filename)) {
      return next();
    }
    if (stats.isDirectory()) {
      dirFiltter(filename);
      return next();
    }
    res.size += stats.size;
    res.fileCount += 1;
    res.fileList.add(filename);
    next();
  }

  await rd.each(base, findOne);

  for (const dir of res.dirList) {
    const { size, files } = await getDirTotalSize(dir);
    files.forEach(it => res.fileList.add(it));
    res.size += size;
  }

  res.removeFiles.forEach(f => {
    if (res.fileList.has(f)) return;
    const s = fs.statSync(f);
    res.fileList.add(f);
    res.size += s.size;
  });

  return res;
}

async function getDirTotalSize(dir: string): Promise<{ size: number; files: string[] }> {
  let size = 0;
  const files: string[] = [];
  await rd.eachFile(dir, (f, s, next) => {
    size += s.size;
    files.push(f);
    next();
  });
  return { size, files };
}

export function reducePackageJson(name: string, write: boolean = false): { size: number; removeFiles: string[] } {
  const origin = fs.readFileSync(name);
  const pkg = JSON.parse(origin.toString());

  let removeFiles: string[] = [];
  if (pkg.name in BLACK_LIST_PACKAGE) {
    const { dirs, files } = BLACK_LIST_PACKAGE[pkg.name];
    const dir = path.dirname(name);
    files.forEach(n => {
      const f = path.resolve(dir, n);
      if (fs.existsSync(f)) {
        removeFiles.push(f);
      }
    });
    dirs.forEach(n => {
      const files = rd2.readFileSync(path.resolve(dir, n));
      removeFiles = removeFiles.concat(files);
    });
  }

  const newPkg: any = {};
  for (const n of WHITE_LIST_PACKAGE_FIELD) {
    newPkg[n] = pkg[n];
  }

  const data = Buffer.from(JSON.stringify(newPkg));
  if (write) {
    fs.writeFileSync(name, data);
  }
  return { size: data.length, removeFiles };
}
