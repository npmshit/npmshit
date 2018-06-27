import rd from "rd/promises";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const BLACK_LIST_FILE = ["license", "license.txt", "license-mit.txt", "gulpfile.js"];
const BLACK_LIST_EXT = [".md"];

export interface IResult {
  size: number;
  packageCount: number;
  fileCount: number;
  fileList: string[];
}

export type Callback = (err: Error | null, res: IResult) => void;

export const rmFile = promisify(fs.unlink);

export function humanFileSize(size: number) {
  var i = Math.floor(Math.log(size) / Math.log(1024));
  return (size / Math.pow(1024, i)).toFixed(2) + " " + ["B", "kB", "MB", "GB", "TB"][i];
}

export function listFiles(base: string): Promise<IResult> {
  const res: IResult = {
    size: 0,
    packageCount: 0,
    fileCount: 0,
    fileList: []
  };

  function filtter(name: string) {
    const file = path.basename(name).toLocaleLowerCase();
    const ext = path.extname(name).toLocaleLowerCase();
    if (file === "package.json") {
      res.packageCount += 1;
    }
    return BLACK_LIST_FILE.indexOf(file) !== -1 || BLACK_LIST_EXT.indexOf(ext) !== -1;
  }

  function findOne(filename: string, stats: fs.Stats, next: () => void) {
    if(!filtter(filename)) {
      return next();
    }
    res.size += stats.size;
    res.fileCount += 1;
    res.fileList.push(filename);
    next();
  }

  return rd.eachFile(base, findOne).then(() => res);
}

