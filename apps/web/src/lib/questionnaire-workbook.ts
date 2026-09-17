export type QuestionnaireImport = {
  questions: Array<{ id: string; label: string; type: 'text' | 'number' | 'select'; required: boolean; options: string[] }>;
  products: Array<{ brand: string; product: string; active: boolean; displayOrder: number }>;
};

const textDecoder = new TextDecoder();

async function unzipXml(file: File): Promise<Map<string, string>> {
  const bytes = new Uint8Array(await file.arrayBuffer()); const view = new DataView(bytes.buffer);
  let eocd = -1; for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65_557); index -= 1) if (view.getUint32(index, true) === 0x06054b50) { eocd = index; break; }
  if (eocd < 0) throw new Error('This is not a valid Excel workbook.');
  const entries = view.getUint16(eocd + 10, true); let offset = view.getUint32(eocd + 16, true); const files = new Map<string, string>();
  for (let entry = 0; entry < entries; entry += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('The Excel workbook directory is invalid.');
    const method = view.getUint16(offset + 10, true); const compressedSize = view.getUint32(offset + 20, true); const nameLength = view.getUint16(offset + 28, true); const extraLength = view.getUint16(offset + 30, true); const commentLength = view.getUint16(offset + 32, true); const localOffset = view.getUint32(offset + 42, true); const name = textDecoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
    if (name.endsWith('.xml') || name.endsWith('.rels')) {
      const localNameLength = view.getUint16(localOffset + 26, true); const localExtraLength = view.getUint16(localOffset + 28, true); const start = localOffset + 30 + localNameLength + localExtraLength; const compressed = bytes.slice(start, start + compressedSize);
      let plain: Uint8Array;
      if (method === 0) plain = compressed;
      else if (method === 8) { const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw')); plain = new Uint8Array(await new Response(stream).arrayBuffer()); }
      else throw new Error('The workbook uses an unsupported compression method.');
      files.set(name, textDecoder.decode(plain));
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

function rowsFromSheet(xml: string, sharedStrings: string[]): string[][] {
  const document = new DOMParser().parseFromString(xml, 'application/xml'); const rows: string[][] = [];
  for (const rowNode of Array.from(document.getElementsByTagName('row'))) {
    const row: string[] = [];
    for (const cell of Array.from(rowNode.getElementsByTagName('c'))) {
      const reference = cell.getAttribute('r') ?? 'A1'; const letters = reference.match(/[A-Z]+/)?.[0] ?? 'A'; let column = 0; for (const letter of letters) column = column * 26 + letter.charCodeAt(0) - 64; column -= 1;
      const type = cell.getAttribute('t'); const raw = cell.getElementsByTagName('v')[0]?.textContent ?? cell.getElementsByTagName('t')[0]?.textContent ?? '';
      row[column] = type === 's' ? sharedStrings[Number(raw)] ?? '' : raw;
    }
    rows.push(row);
  }
  return rows;
}

function records(rows: string[][]): Array<Record<string, string>> {
  const headers = (rows[0] ?? []).map((value) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ''));
  return rows.slice(1).filter((row) => row.some((value) => String(value ?? '').trim())).map((row) => Object.fromEntries(headers.map((header, index) => [header, String(row[index] ?? '').trim()])));
}

export async function readQuestionnaireWorkbook(file: File): Promise<QuestionnaireImport> {
  const files = await unzipXml(file); const parser = new DOMParser();
  const sharedXml = files.get('xl/sharedStrings.xml'); const sharedStrings = sharedXml ? Array.from(parser.parseFromString(sharedXml, 'application/xml').getElementsByTagName('si')).map((node) => Array.from(node.getElementsByTagName('t')).map((text) => text.textContent ?? '').join('')) : [];
  const workbook = parser.parseFromString(files.get('xl/workbook.xml') ?? '', 'application/xml'); const relationships = parser.parseFromString(files.get('xl/_rels/workbook.xml.rels') ?? '', 'application/xml'); const targets = new Map(Array.from(relationships.getElementsByTagName('Relationship')).map((item) => [item.getAttribute('Id') ?? '', item.getAttribute('Target') ?? '']));
  const sheets = new Map<string, string[][]>();
  for (const sheet of Array.from(workbook.getElementsByTagName('sheet'))) { const name = sheet.getAttribute('name') ?? ''; const id = sheet.getAttribute('r:id') ?? sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? ''; const target = targets.get(id); if (!target) continue; const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`; const xml = files.get(path); if (xml) sheets.set(name.toLowerCase(), rowsFromSheet(xml, sharedStrings)); }
  const questionRows = records(sheets.get('questionnaire') ?? []); const productRows = records(sheets.get('products') ?? []);
  const questions: QuestionnaireImport['questions'] = questionRows.map((row) => { const type: 'text' | 'number' | 'select' = row.type === 'number' || row.type === 'select' ? row.type : 'text'; return { id: row.fieldid ?? '', label: row.label ?? '', type, required: !['no', 'false', '0'].includes((row.required ?? '').toLowerCase()), options: (row.options ?? '').split('|').map((value) => value.trim()).filter(Boolean) }; });
  const products = productRows.map((row, index) => ({ brand: row.brand ?? '', product: row.product ?? '', active: !['no', 'false', '0'].includes((row.active ?? '').toLowerCase()), displayOrder: Number(row.displayorder) || index + 1 })).filter((item) => item.active);
  if (!questions.length && !products.length) throw new Error('The workbook needs Questionnaire or Products rows. Do not rename the template sheets or headers.');
  return { questions, products };
}
