// Converte o catálogo de benefícios (JPEG) num PDF de 1 página, embutindo o
// JPEG original via DCTDecode (sem recomprimir, sem dependências novas).
// Execute: node scripts/convert-catalogo-pdf.js

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../uploads/beneficios/catalogo-beneficios-seci.pdf.jpeg');
const DEST = path.join(__dirname, '../uploads/beneficios/catalogo-beneficios-seci.pdf');
const TARGET_DPI = 150; // mapeia pixels -> pontos PDF (72pt/in) assumindo ~150dpi de origem

function readJpegDimensions(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      return {
        height: buf.readUInt16BE(i + 5),
        width: buf.readUInt16BE(i + 7),
        components: buf[i + 9],
      };
    }
    if (marker === 0xd8 || marker === 0xd9) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  throw new Error('Não foi possível ler as dimensões do JPEG (marcador SOF não encontrado)');
}

function buildPdf(jpegBuf, { width, height, components }) {
  const colorSpace = components === 1 ? '/DeviceGray' : components === 4 ? '/DeviceCMYK' : '/DeviceRGB';
  const pdfWidth = Math.round((width * 72) / TARGET_DPI);
  const pdfHeight = Math.round((height * 72) / TARGET_DPI);

  const contentStream = `q\n${pdfWidth} 0 0 ${pdfHeight} 0 0 cm\n/Im0 Do\nQ`;

  const objects = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfWidth} ${pdfHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  // objeto 4 (imagem) e 5 (conteúdo) são stream — tratados à parte abaixo

  const parts = [];
  const offsets = [];
  let cursor = 0;

  function push(str) {
    const buf = Buffer.from(str, 'latin1');
    parts.push(buf);
    cursor += buf.length;
  }
  function pushBuf(buf) {
    parts.push(buf);
    cursor += buf.length;
  }
  function startObj(n) {
    offsets[n] = cursor;
    push(`${n} 0 obj\n`);
  }
  function endObj() {
    push('\nendobj\n');
  }

  push('%PDF-1.4\n');

  startObj(1);
  push(objects[0]);
  endObj();

  startObj(2);
  push(objects[1]);
  endObj();

  startObj(3);
  push(objects[2]);
  endObj();

  startObj(4);
  push(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace ${colorSpace} /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBuf.length} >>\nstream\n`);
  pushBuf(jpegBuf);
  push('\nendstream');
  endObj();

  const contentBuf = Buffer.from(contentStream, 'latin1');
  startObj(5);
  push(`<< /Length ${contentBuf.length} >>\nstream\n`);
  pushBuf(contentBuf);
  push('\nendstream');
  endObj();

  const xrefStart = cursor;
  const objCount = 6;
  push(`xref\n0 ${objCount}\n`);
  push('0000000000 65535 f \n');
  for (let n = 1; n < objCount; n++) {
    push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${objCount} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  return Buffer.concat(parts);
}

function run() {
  if (!fs.existsSync(SRC)) {
    console.error(`Arquivo de origem não encontrado: ${SRC}`);
    process.exit(1);
  }
  const jpegBuf = fs.readFileSync(SRC);
  const dims = readJpegDimensions(jpegBuf);
  console.log(`JPEG lido: ${dims.width}x${dims.height}px, ${dims.components} componente(s)`);

  const pdfBuf = buildPdf(jpegBuf, dims);
  fs.writeFileSync(DEST, pdfBuf);
  console.log(`PDF gerado em ${DEST} (${pdfBuf.length} bytes)`);
}

run();
