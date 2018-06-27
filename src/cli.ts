import program, { Command } from "commander";
import { Spinner } from "cli-spinner";
const { version, description } = require("../package.json");
import { listFiles, humanFileSize, IResult, rmFile } from "./index";
import inquirer from "inquirer";

const promptDelete = [{ type: "confirm", name: "confirmDelete", message: "是否确定执行删除操作: ", default: false }];

function sleep(ms: number) {
  ms = ms > 0 ? ms : 0;
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function logRes(ret: IResult) {
  console.log(`包总数：${ret.packageCount}，可删除文件：${ret.fileCount}，可释放空间：${humanFileSize(ret.size)}`);
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
  const listFile = listFiles("/Users/Yourtion/Codes/OpenSource/npmshit/npmshit/node_modules");
  const ret = await spinner("努力扫描中...", listFile);
  logRes(ret);
  if(env.list) return;
  const { confirmDelete } = (await inquirer.prompt(promptDelete)) as { confirmDelete: boolean };
  if (!confirmDelete) return;
  const rms = ret.fileList.map(it => {
    console.log("删除文件：%s", it);
    return rmFile(it);
  });
  await Promise.all(rms);
  console.log("删除完成！释放空间：", humanFileSize(ret.size));
}

main(env).catch(console.error)
