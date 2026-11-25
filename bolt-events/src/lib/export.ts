import { strToU8, zipSync } from 'fflate';
export type Table = { name: string; columns: string[]; rows: unknown[][] };

// Cells that spreadsheets would run as formulas are neutralised.
const guard = (v: unknown) => { const s = v == null ? '' : String(v); return /^[=+\-@\t\r]/.test(s) && typeof v !== 'number' ? `'${s}` : s; };
export const toCsv = (t: Table) => '\ufeff' + [t.columns, ...t.rows].map((r) => r.map((c) => { const s = guard(c); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\r\n');

const esc = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const col = (i: number): string => (i >= 26 ? col(Math.floor(i / 26) - 1) : '') + String.fromCharCode(65 + (i % 26));
export function toXlsx(t: Table): Uint8Array {
  // inline strings are never evaluated as formulas
  const cell = (v: unknown, r: number, c: number, s = '') => typeof v === 'number' ? `<c r="${col(c)}${r}"${s}><v>${v}</v></c>` : `<c r="${col(c)}${r}" t="inlineStr"${s}><is><t xml:space="preserve">${esc(v == null ? '' : String(v))}</t></is></c>`;
  const rows = [t.columns, ...t.rows].map((r, i) => `<row r="${i + 1}">${r.map((v, c) => cell(v, i + 1, c, i ? '' : ' s="1"')).join('')}</row>`).join('');
  const x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>', ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships', pk = 'http://schemas.openxmlformats.org/package/2006';
  const files: Record<string, string> = {
    '[Content_Types].xml': `${x}<Types xmlns="${pk}/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels': `${x}<Relationships xmlns="${pk}/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `${x}<workbook xmlns="${ns}" xmlns:r="${rel}"><sheets><sheet name="${esc(t.name.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `${x}<Relationships xmlns="${pk}/relationships"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${rel}/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': `${x}<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>`,
    'xl/worksheets/sheet1.xml': `${x}<worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${t.columns.map((_, i) => `<col min="${i + 1}" max="${i + 1}" width="20" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData></worksheet>`,
  };
  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));
}
