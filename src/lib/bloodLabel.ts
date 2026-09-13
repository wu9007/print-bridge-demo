/** 侧栏变量。业务项目用接口数据填同样的 key。 */

export interface BloodLabelData {
  stationName: string;
  license: string;
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

/** 已知 key 的中文名。解析出的新变量没有名字时，侧栏直接显示 key。 */
export const FIELD_LABELS: Record<string, string> = {
  stationName: "血站",
  license: "许可证",
  donCode: "献血码",
  donCodeHr: "献血码人读",
  aboCode: "血型码",
  abo: "ABO",
  rhd: "RhD",
  prodCode: "产品码",
  prodName: "产品名称",
  volume: "规格",
  preservative: "保养液",
  storage: "储存",
  collector: "采集者",
  producer: "制备者",
  bagCode: "血袋码",
  expireAt: "有效期至",
  collectAt: "采集时间",
  produceAt: "制备时间",
};

export const CHONGQING_SAMPLE: BloodLabelData = {
  stationName: "重庆市血液中心",
  license: "血站执业许可证：50010311F11010099",
  donCode: "500000261429227",
  donCodeHr: "500000 261429227 U",
  aboCode: "51000",
  rhd: "RhD阳性",
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
