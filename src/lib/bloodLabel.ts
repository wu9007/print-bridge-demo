/** 侧栏变量。业务项目用接口数据填同样的 key。 */

export interface BloodLabelData {
  stationName: string;
  license: string;
  apply: string;
  notice: string;
  donCode: string;
  donCodeHr: string;
  aboCode: string;
  abo: string;
  rhd: string;
  prodCode: string;
  prodName: string;
  volume: string;
  preservative: string;
  storage: string;
  collector: string;
  producer: string;
  bagCode: string;
  expireAt: string;
  collectAt: string;
  produceAt: string;
}

/** 侧栏只展示一半。打印仍用 CHONGQING_SAMPLE 填完整 .prn。 */
export const LABEL_FIELDS: Array<{ key: keyof BloodLabelData; label: string }> = [
  { key: "donCode", label: "献血码" },
  { key: "donCodeHr", label: "献血码人读" },
  { key: "abo", label: "ABO" },
  { key: "rhd", label: "RhD" },
  { key: "prodCode", label: "产品码" },
  { key: "bagCode", label: "血袋码" },
  { key: "volume", label: "规格" },
  { key: "expireAt", label: "有效期至" },
  { key: "prodName", label: "产品名称" },
  { key: "stationName", label: "血站" },
];

export const CHONGQING_SAMPLE: BloodLabelData = {
  stationName: "重庆市血液中心",
  license: "血站执业许可证：50010311F11010099",
  apply: "临床适应证：适用于凝血因子缺乏或大量输血伴有凝血障碍的患者。",
  notice:
    "注意事项：输注前请检查包装是否完好无损，外观是否正常，将血浆制剂摇匀；除生理盐水外，血液制剂不得与任何药剂在同一输液器内输注。解冻后可在2-6℃保存，应24h内输注。",
  donCode: "500000261429227",
  donCodeHr: "500000 261429227 U",
  aboCode: "51000",
  rhd: "RhD阳性性",
  abo: "0",
  prodCode: "E54720000",
  prodName: "病毒灭活新鲜冰冻血浆200ml",
  volume: "200ml",
  preservative: "ACD-B",
  storage: "≤-18℃",
  collector: "chenshens",
  producer: "hmmmm",
  bagCode: "02725511366",
  expireAt: "2027-09-08 11:36",
  collectAt: "2026-09-08 11:36",
  produceAt: "2026-09-08 17:22",
};
