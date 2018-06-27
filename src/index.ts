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

export interface IResult {
  totalSize: number;
  size: number;
  packageCount: number;
  fileCount: number;
  fileList: string[];
}

export type Callback = (err: Error | null, res: IResult) => void;

export const unlinkAsync = promisify(fs.unlink);

export const statAsync = promisify(fs.stat);

export function humanFileSize(size: number) {
  if (size < 1) return "0 B";
  var i = Math.floor(Math.log(size) / Math.log(1024));
  return (size / Math.pow(1024, i)).toFixed(2) + " " + ["B", "kB", "MB", "GB", "TB"][i];
}

export function listFiles(base: string): Promise<IResult> {
  const res: IResult = {
    totalSize: 0,
    size: 0,
    packageCount: 0,
    fileCount: 0,
    fileList: [],
  };

  function filtter(name: string) {
    const file = path.basename(name).toLocaleLowerCase();
    if (file === "package.json") {
      res.packageCount += 1;
    }

    if (file[0] === ".") return true;

    if (BLACK_LIST_FILE.indexOf(file) !== -1) return true;

    const ext = path.extname(name).toLocaleLowerCase();
    if (BLACK_LIST_EXT.indexOf(ext) !== -1) return true;
  }

  function findOne(filename: string, stats: fs.Stats, next: () => void) {
    res.totalSize += stats.size;
    if (!filtter(filename)) {
      return next();
    }
    res.size += stats.size;
    res.fileCount += 1;
    res.fileList.push(filename);
    next();
  }

  return rd.eachFile(base, findOne).then(() => res);
}
