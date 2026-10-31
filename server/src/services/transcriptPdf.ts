/**
 * Black and white A4 PDF rendering of the OBE co-curricular transcript.
 * Only #000000 and #FFFFFF are used; emphasis comes from weight and rules.
 */
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { formatDhaka } from '../utils/time.js';
import { Transcript, TranscriptSummary } from './transcriptService.js';

const BLACK = '#000000';
const LEFT = 50;
const WIDTH = 495;

type Doc = PDFKit.PDFDocument;

function header(doc: Doc, t: Transcript, s: TranscriptSummary): void {
  doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(16).text('CO-CURRICULAR TRANSCRIPT (OBE)', LEFT, 50, { width: WIDTH, align: 'center' });
  doc.font('Helvetica').fontSize(9).text('University of Information Technology and Sciences (UITS) | CampusConnect', { width: WIDTH, align: 'center' });
  doc.text('Mapped to BAETE Program Outcomes PO1 - PO12', { width: WIDTH, align: 'center' });
  doc.moveTo(LEFT, doc.y + 6).lineTo(LEFT + WIDTH, doc.y + 6).lineWidth(1).strokeColor(BLACK).stroke();
  doc.moveDown(1).fontSize(10);
  doc.font('Helvetica-Bold').text(`Name: ${t.student.full_name}`, LEFT);
  doc.font('Helvetica').text(`Student ID: ${t.student.student_id_number} | Department: ${t.student.department} | Batch: ${t.student.batch_year}`);
  doc.text(`Transcript ID: ${s.tid} | Issued: ${formatDhaka(s.issued_at)} (Asia/Dhaka)`);
}

function activities(doc: Doc, t: Transcript): void {
  doc.moveDown(0.8).font('Helvetica-Bold').fontSize(11).text('Activities', LEFT);
  if (t.semesters.length === 0) doc.font('Helvetica').fontSize(9).text('No attended activities recorded.');
  for (const sem of t.semesters) {
    doc.moveDown(0.3).font('Helvetica-Bold').fontSize(9).text(sem.name, LEFT);
    for (const a of sem.activities) {
      const tags = a.po_tags.map((p) => `${p.code}(${p.weight})`).join(' ') || '-';
      doc.font('Helvetica').fontSize(8.5).text(
        `${a.attended_date} | ${a.event_title} | ${a.club_name} | ${a.club_role} | POs: ${tags}${a.certificate_serial ? ` | Cert: ${a.certificate_serial}` : ''}${a.reflection ? ' | Reflection' : ''}`,
        LEFT + 10, undefined, { width: WIDTH - 10 });
    }
  }
}

function attainmentTable(doc: Doc, t: Transcript): void {
  doc.moveDown(0.8).font('Helvetica-Bold').fontSize(11).text('Attainment Summary', LEFT);
  const cols = [LEFT, LEFT + 50, LEFT + 260, LEFT + 330];
  const row = (cells: readonly string[], bold: boolean): void => {
    const y = doc.y + 2;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5);
    cells.forEach((c, i) => doc.text(c, cols[i], y, { width: (cols[i + 1] ?? LEFT + WIDTH) - cols[i] - 4, lineBreak: false }));
    doc.y = y + 12;
    doc.moveTo(LEFT, doc.y).lineTo(LEFT + WIDTH, doc.y).lineWidth(bold ? 1 : 0.4).strokeColor(BLACK).stroke();
  };
  row(['PO', 'Outcome', 'Points', 'Level'], true);
  const titles = new Map<string, string>(PO_TITLES);
  for (const o of t.attainment.outcomes) row([o.code, titles.get(o.code) ?? '', o.points.toFixed(2), o.level], false);
  doc.moveDown(0.4).font('Helvetica').fontSize(7.5).text(
    'Levels: NOT_STARTED = 0 points | DEVELOPING < 3 | PROFICIENT 3 to < 6 | EXEMPLARY >= 6. Points: tagged event weight, +50% with reflection, plus club role credit.',
    LEFT, undefined, { width: WIDTH });
}

const PO_TITLES: readonly (readonly [string, string])[] = [
  ['PO1', 'Engineering knowledge'], ['PO2', 'Problem analysis'], ['PO3', 'Design/development of solutions'],
  ['PO4', 'Investigation'], ['PO5', 'Modern tool usage'], ['PO6', 'The engineer and society'],
  ['PO7', 'Environment and sustainability'], ['PO8', 'Ethics'], ['PO9', 'Individual work and teamwork'],
  ['PO10', 'Communication'], ['PO11', 'Project management and finance'], ['PO12', 'Life-long learning']
];

async function verification(doc: Doc, verifyUrl: string, jws: string | null): Promise<void> {
  const qr = await QRCode.toBuffer(verifyUrl, { margin: 1, width: 90, color: { dark: BLACK, light: '#FFFFFF' } });
  if (doc.y > 640) doc.addPage();
  const y = doc.y + 10;
  doc.image(qr, LEFT, y, { width: 80 });
  doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK).text('Verify this transcript', LEFT + 95, y);
  doc.font('Helvetica').fontSize(8).text(verifyUrl, LEFT + 95, undefined, { width: WIDTH - 95 });
  doc.text(jws ? 'Digitally signed (EdDSA / Ed25519). Signature:' : 'Unsigned snapshot (signing key unavailable).', { width: WIDTH - 95 });
  if (jws) doc.font('Courier').fontSize(5).text(jws, { width: WIDTH - 95 });
}

export async function renderTranscriptPdf(t: Transcript, s: TranscriptSummary, jws: string | null, verifyUrl: string): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Co-Curricular Transcript ${s.tid}` } });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  header(doc, t, s);
  activities(doc, t);
  attainmentTable(doc, t);
  await verification(doc, verifyUrl, jws);
  doc.end();
  return done;
}
