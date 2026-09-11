export type CommandLanguage = "zpl" | "tspl";

export const SAMPLE_ZPL = `^XA
^CI28
^PW600
^LL400
^FO40,40^A0N,42,42^FDPrintBridge Demo^FS
^FO40,100^A0N,28,28^FDRAW · ZPL II^FS
^FO40,160^BY2^BCN,90,Y,N,N^FDDEMO-001^FS
^XZ
`;

export const SAMPLE_TSPL = `SIZE 60 mm,40 mm
GAP 2 mm,0
CLS
TEXT 40,40,"3",0,1,1,"PrintBridge Demo"
TEXT 40,80,"2",0,1,1,"RAW · TSPL"
BARCODE 40,120,"128",80,1,0,2,2,"DEMO-001"
PRINT 1,1
`;

export function sampleFor(language: CommandLanguage): string {
  return language === "zpl" ? SAMPLE_ZPL : SAMPLE_TSPL;
}
