import path from "path";
import program, { Command } from "commander";
import { Spinner } from "cli-spinner";
const { version, description } = require("../package.json");
import { listFiles, humanFileSize, IResult, unlinkAsync, statAsync, reducePackageJson, rmdir } from "./index";
import readline from "readline";

function prompt(q: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => {
    rl.question(q, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

function sleep(ms: number) {
  ms = ms > 0 ? ms : 0;
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function logRes(ret: IResult, list: boolean) {
  if (list) {
    ret.fileList.forEach(n => console.log(n));
  }
  console.log(`包总数：${ret.packageCount}，可删除文件：${ret.fileCount}，可释放空间：${humanFileSize(ret.size)}`);
  console.log(`原始大小：${humanFileSize(ret.totalSize)}，占比：${((ret.size / ret.totalSize) * 100).toFixed(1)}%`);
  console.log(`通过package.json压缩节省：${humanFileSize(ret.packageFreeSize)}`);
}

async function spinner<T>(title: string, fn: Promise<T>, delay = 2000) {
  const start = Date.now();
  const spinner = new Spinner(title);
  spinner.setSpinnerString(18);
  spinner.start();
  const ret = await fn;
  const time = Date.now() - start;
  await sleep(delay - time);
  spinner.stop();
  process.stdout.write("\n");
  return ret;
}

const env = program
  .version(version, "-v, --version")
  .option("-l, --list", "list only")
  .description(description)
  .parse(process.argv);

async function main(env: Command) {
  const dir = path.resolve(process.cwd(), "node_modules");
  try {
    await statAsync(dir);
  } catch (error) {
    throw new Error("当前目录没有 node_modules");
  }
  const listFile = listFiles(dir);
  const ret = await spinner("努力扫描中...", listFile, env.list ? 0 : 2000);

  if (ret.size < 1) {
    console.log("恭喜！ node_modules 目录很干净");
    return;
  }

  logRes(ret, env.list);
  if (env.list) return;

  const del = await prompt("是否确定执行删除操作: (y/N) ");
  const confirmDelete = del.toLowerCase() === "y";
  if (!confirmDelete) return;
  const rms: any[] = [];
  ret.fileList.forEach(it => {
    console.log("删除文件：%s", it);
    rms.push(unlinkAsync(it).catch(err => 0));
  });
  await Promise.all(rms);
  const dirs: any[] = [];
  ret.dirList.forEach(n => dirs.push(rmdir(n)));
  await Promise.all(dirs);
  ret.packageFileList.forEach(n => reducePackageJson(n, true));

  console.log("删除完成！释放空间：", humanFileSize(ret.size));
}

main(env).catch(err => console.error(err.message || err));
