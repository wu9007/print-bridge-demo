import minimal from "../templates/minimal.zpl?raw";
import rhPositive from "../templates/rh-positive.zpl?raw";
import rhNegative from "../templates/rh-negative.zpl?raw";
import unqualified from "../templates/unqualified.zpl?raw";

export type TemplateId = "minimal" | "rh-positive" | "rh-negative" | "unqualified";

export type ZplTemplate = {
  id: TemplateId;
  name: string;
  text: string;
};

/** 业务仓自己的模板。SDK 只收 text，不认识这些 id。 */
export const ZPL_TEMPLATES: ZplTemplate[] = [
  { id: "minimal", name: "最小命令", text: minimal },
  { id: "rh-positive", name: "重庆阳性血标签", text: rhPositive },
  { id: "rh-negative", name: "重庆阴性血标签", text: rhNegative },
  { id: "unqualified", name: "不合格标签", text: unqualified },
];

export function getTemplate(id: TemplateId): ZplTemplate {
  const found = ZPL_TEMPLATES.find((item) => item.id === id);
  if (!found) {
    throw new Error(`未知模板: ${id}`);
  }
  return found;
}
