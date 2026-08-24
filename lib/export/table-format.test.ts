import { sheetToCsv } from "./table-format";

const csv = sheetToCsv({
  name: "t",
  headers: ["标题", "备注"],
  rows: [
    ["普通", "无逗号"],
    ['含"引号"', "a,b"],
    ["换\n行", null],
  ],
});

if (!csv.startsWith("\uFEFF")) throw new Error("csv 应带 BOM");
if (!csv.includes('"含""引号"""')) throw new Error("引号未转义");
if (!csv.includes('"a,b"')) throw new Error("逗号未加引号");

console.log("lib/export table-format ok");
