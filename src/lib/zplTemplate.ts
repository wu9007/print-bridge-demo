import aerospace from "../templates/aerospace.zpl?raw";
import hospital from "../templates/hospital.zpl?raw";
import industrial from "../templates/industrial.zpl?raw";
import minimal from "../templates/minimal.zpl?raw";

export type TemplateId = "minimal" | "hospital" | "aerospace" | "industrial";

export type ZplTemplate = {
  id: TemplateId;
  name: string;
  text: string;
};

/** 业务仓自己的模板。SDK 只收 text，不认识这些 id。 */
export const ZPL_TEMPLATES: ZplTemplate[] = [
  { id: "minimal", name: "最小命令", text: minimal },
  { id: "hospital", name: "医院就诊签", text: hospital },
  { id: "aerospace", name: "航材标签", text: aerospace },
  { id: "industrial", name: "工业物料签", text: industrial },
];

export function getTemplate(id: TemplateId): ZplTemplate {
  const found = ZPL_TEMPLATES.find((item) => item.id === id);
  if (!found) {
    throw new Error(`未知模板: ${id}`);
  }
  return found;
}
