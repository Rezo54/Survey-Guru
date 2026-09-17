export type QuestionnaireImport = {
  questions: Array<{ id: string; label: string; type: 'text' | 'number' | 'select'; required: boolean; options: string[]; additionalRow: boolean }>;
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
  for (const rowNode of Array.from(document.getElementsByTagNameNS('*', 'row'))) {
    const row: string[] = [];
    for (const cell of Array.from(rowNode.getElementsByTagNameNS('*', 'c'))) {
      const reference = cell.getAttribute('r') ?? 'A1'; const letters = reference.match(/[A-Z]+/)?.[0] ?? 'A'; let column = 0; for (const letter of letters) column = column * 26 + letter.charCodeAt(0) - 64; column -= 1;
      const type = cell.getAttribute('t'); const raw = cell.getElementsByTagNameNS('*', 'v')[0]?.textContent ?? cell.getElementsByTagNameNS('*', 't')[0]?.textContent ?? '';
      row[column] = type === 's' ? sharedStrings[Number(raw)] ?? '' : raw;
    }
    rows.push(row);
  }
  return rows;
}

function normalizedHeader(value: string | undefined): string {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function records(rows: string[][], expectedHeaders: string[]): Array<Record<string, string>> {
  const headerIndex = rows.findIndex((row) => {
    const headers = row.map(normalizedHeader);
    return expectedHeaders.some((header) => headers.includes(header));
  });
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex]!.map(normalizedHeader);
  return rows.slice(headerIndex + 1).map((row) => Object.fromEntries(headers.filter(Boolean).map((header, index) => [header, String(row[index] ?? '').trim()])));
}

function generatedFieldId(label: string, index: number): string {
  const words = label.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').match(/[A-Za-z0-9]+/g) ?? [];
  const camelCase = words.map((word, wordIndex) => {
    const lower = word.toLowerCase();
    return wordIndex === 0 ? lower : `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
  }).join('');
  const withLetterPrefix = /^[A-Za-z]/.test(camelCase) ? camelCase : `field${camelCase}`;
  return withLetterPrefix.length >= 3 ? withLetterPrefix : `question${index + 1}`;
}

function uniqueFieldId(candidate: string, used: Set<string>): string {
  let id = candidate;
  let suffix = 2;
  while (used.has(id.toLowerCase())) { id = `${candidate}${suffix}`; suffix += 1; }
  used.add(id.toLowerCase());
  return id;
}

export async function readQuestionnaireWorkbook(file: File): Promise<QuestionnaireImport> {
  const files = await unzipXml(file); const parser = new DOMParser();
  const sharedXml = files.get('xl/sharedStrings.xml'); const sharedStrings = sharedXml ? Array.from(parser.parseFromString(sharedXml, 'application/xml').getElementsByTagNameNS('*', 'si')).map((node) => Array.from(node.getElementsByTagNameNS('*', 't')).map((text) => text.textContent ?? '').join('')) : [];
  const workbook = parser.parseFromString(files.get('xl/workbook.xml') ?? '', 'application/xml'); const relationships = parser.parseFromString(files.get('xl/_rels/workbook.xml.rels') ?? '', 'application/xml'); const targets = new Map(Array.from(relationships.getElementsByTagNameNS('*', 'Relationship')).map((item) => [item.getAttribute('Id') ?? '', item.getAttribute('Target') ?? '']));
  const sheets = new Map<string, string[][]>();
  for (const sheet of Array.from(workbook.getElementsByTagNameNS('*', 'sheet'))) { const name = sheet.getAttribute('name') ?? ''; const id = sheet.getAttribute('r:id') ?? sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? ''; const target = targets.get(id); if (!target) continue; const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`; const xml = files.get(path); if (xml) sheets.set(name.toLowerCase(), rowsFromSheet(xml, sharedStrings)); }
  const questionRows = records(sheets.get('questionnaire') ?? [], ['fieldid', 'labelshowntocapturer']); const productRows = records(sheets.get('products') ?? [], ['brand', 'product']);
  const usedIds = new Set<string>();
  const questions: QuestionnaireImport['questions'] = questionRows.flatMap((row, index) => {
    const explicitId = row.fieldid ?? '';
    const label = (row.labelshowntocapturer ?? row.label ?? explicitId).trim();
    if (!label) return [];
    const idCandidate = /^[A-Za-z][A-Za-z0-9_]{2,63}$/.test(explicitId) ? explicitId : generatedFieldId(label, index);
    const rawType = (row.type ?? '').toLowerCase();
    const options = (row.optionsusebetweenchoices ?? row.options ?? '').split(/[|;\n]+/).map((value) => value.trim()).filter(Boolean);
    const type: 'text' | 'number' | 'select' = options.length || rawType.includes('select') || rawType.includes('tick')
      ? 'select'
      : rawType.includes('number') || rawType.includes('price') || rawType.includes('volume')
        ? 'number'
        : 'text';
    const additionalRowValue = (row.additionalrow ?? '').trim().toLowerCase();
    return [{ id: uniqueFieldId(idCandidate, usedIds), label, type, required: !['no', 'false', '0'].includes((row.required ?? '').toLowerCase()), options, additionalRow: additionalRowValue.startsWith('yes') || additionalRowValue.includes('auto add') }];
  });
  const products = productRows.map((row, index) => ({ brand: row.brand ?? '', product: row.product ?? '', active: !['no', 'false', '0'].includes((row.active ?? '').toLowerCase()), displayOrder: Number(row.displayorder) || index + 1 })).filter((item) => item.active && item.brand && item.product);
  if (!questions.length && !products.length) throw new Error('The workbook needs Questionnaire or Products rows. Do not rename the template sheets or headers.');
  return { questions, products };
}
