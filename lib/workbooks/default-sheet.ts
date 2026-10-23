/**
 * FortuneSheet 默认工作簿：问题台账式表头（飞书表常见列）。
 * 不做透视/重公式；图片可走单元格内插图（编辑器自带）。
 */

export type FortuneSheetData = Array<Record<string, unknown>>;

const HEADERS = ["板块", "问题描述", "现状", "相关图片", "影响", "出处"] as const;

function headerCell(text: string) {
  return {
    v: text,
    m: text,
    ct: { fa: "General", t: "g" },
    bl: 1,
    bg: "#EEF2FF",
  };
}

export function createDefaultSheetData(title = "问题台账"): FortuneSheetData {
  const celldata = HEADERS.map((h, c) => ({
    r: 0,
    c,
    v: headerCell(h),
  }));

  return [
    {
      name: title.slice(0, 31) || "Sheet1",
      id: "sheet-1",
      status: 1,
      order: 0,
      row: 60,
      column: 12,
      celldata,
      config: {
        columnlen: {
          "0": 100,
          "1": 220,
          "2": 180,
          "3": 120,
          "4": 140,
          "5": 160,
        },
      },
    },
  ];
}
