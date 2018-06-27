import rd from "rd/promises";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const BLACK_LIST_FILE = [
  "license",
  "license.txt",
  "license-mit.txt",
  "author",
  "changelog",
  "codeowners",

  "gulpfile.js",
  "bower.json",

  "tsconfig.json",

  "tslint.json",
  "tslint.yaml",
];
const BLACK_LIST_EXT = [".md", ".markdown", ".map"];
const BLACK_LIST_ADVJS_EXT = [".min.js", ".runtime.js", ".test.js", ".spec.js", ".debug.js"];
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

export interface IResult {
  totalSize: number;
  size: number;
  packageFreeSize: number;
  packageCount: number;
  fileCount: number;
  fileList: string[];
  dirList: string[];
  packageFileList: string[];
}

export type Callback = (err: Error | null, res: IResult) => void;

export const unlinkAsync = promisify(fs.unlink);

export const statAsync = promisify(fs.stat);

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
    fileList: [],
    dirList: [],
    packageFileList: [],
  };

  function fileFiltter(name: string) {
    const file = path.basename(name).toLocaleLowerCase();
    if (file === "package.json") {
      res.packageCount += 1;
      res.packageFileList.push(name);
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
    if (BLACK_LIST_DIR.indexOf(dir) !== -1) res.dirList.push(name);
  }

  function process(name: string, stats: fs.Stats) {
    const file = path.basename(name).toLocaleLowerCase();
    if (file === "package.json") {
      const newSize = reducePackageJson(name);
      const size = stats.size - newSize;
      res.size += size;
      res.packageFreeSize += size;
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
    res.fileList.push(filename);
    next();
  }

  await rd.each(base, findOne);

  for (const dir of res.dirList) {
    const { size, files } = await getDirTotalSize(dir);
    res.fileList = res.fileList.concat(files);
    res.size += size;
  }

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

export function reducePackageJson(name: string, write: boolean = false): number {
  const origin = fs.readFileSync(name);
  const pkg = JSON.parse(origin.toString());
  for (const i in pkg) {
    if (i[0] === "_") delete pkg[i];
    else if (i.indexOf("config") !== -1) delete pkg[i];
  }
  delete pkg.devDependencies;
  delete pkg.homepage;
  delete pkg.bugs;
  delete pkg.keywords;
  delete pkg.repository;
  delete pkg.files;
  delete pkg.description;
  const data = Buffer.from(JSON.stringify(pkg));
  if (write) {
    fs.writeFileSync(name, data);
  }
  return data.length;
}
