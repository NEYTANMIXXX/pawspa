const puppeteer = (() => {
  try { return require('puppeteer'); } catch (e) { return null; }
})();
const PDFDocument = (() => {
  try { return require('pdfkit'); } catch (e) { return null; }
})();
const { supabaseAdmin } = require('../services/supabase');

const ensureBucket = async (bucketName) => {
  const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
  if (error) throw error;
  const exists = (buckets || []).some(b => b.name === bucketName);
  if (!exists) {
    const { error: createErr } = await supabaseAdmin.storage.createBucket(bucketName, { public: true });
    if (createErr) throw createErr;
  }
};

async function generatePdfAndUpload({ html, bucket = 'documentos', path }) {
  const pdfBuffer = await generatePdfBuffer({ html });
  if (!pdfBuffer) return null;

  await ensureBucket(bucket);

  const { error: uploadError } = await supabaseAdmin.storage.from(bucket).upload(path, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: true,
  });

  if (uploadError) {
    console.error('[pdf.service] error subiendo PDF:', uploadError.message || uploadError);
    return null;
  }

  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || null;
}

async function generatePdfBuffer({ html }) {
  try {
    if (puppeteer) {
      const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        return await page.pdf({ format: 'A4', printBackground: true });
      } finally {
        try { await browser.close(); } catch (_) {}
      }
    }

    if (!PDFDocument) {
      console.warn('[pdf.service] ni puppeteer ni pdfkit están disponibles — se omite generación de PDF.');
      return null;
    }

    return await generatePdfBufferFromHtml(html);
  } catch (err) {
    console.warn('[pdf.service] puppeteer falló, usando fallback PDFKit:', err.message || err);
    if (!PDFDocument) return null;
    return await generatePdfBufferFromHtml(html);
  }
}

async function generatePdfBufferFromHtml(html) {
  const text = htmlToPlainText(html);
  const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true });
  const chunks = [];

  doc.on('data', (chunk) => chunks.push(chunk));

  const finished = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.font('Helvetica-Bold').fontSize(18).text('PawSpa', { align: 'center' });
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(9).fillColor('#6b7280').text('Reporte de mascota', { align: 'center' });
  doc.moveDown(1);
  doc.fillColor('#111827').fontSize(10);

  const lines = text.split('\n').map((line) => line.trimEnd()).filter((line) => line.trim().length > 0);
  lines.forEach((line) => {
    if (doc.y > doc.page.height - 72) doc.addPage();
    const isHeading = /^#{1,3}\s/.test(line) || /^(Reporte de|Historial clínico y estético|Galería de evolución|Estado de puntos o promociones|Servicios completados|Puntos|Nivel|Promociones activas|Cupones)/i.test(line);
    if (isHeading) {
      doc.moveDown(0.35);
      doc.font('Helvetica-Bold').fontSize(11).text(line.replace(/^#{1,3}\s/, ''), { width: 500 });
      doc.font('Helvetica').fontSize(10);
    } else {
      doc.text(line, { width: 500, align: 'left' });
    }
    doc.moveDown(0.15);
  });

  doc.end();
  return finished;
}

function htmlToPlainText(html) {
  return String(html || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|h4|li|tr)>/gi, '\n')
    .replace(/<\s*(h1|h2|h3|h4|p|div|section|article|ul|ol|table|thead|tbody|tr|li)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
module.exports = { generatePdfAndUpload, generatePdfBuffer };
