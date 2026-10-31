import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { env } from '../config/env.js';

/** Logical prefix stored in certificates.pdf_url; files are served only via the authenticated download route. */
export const CERT_PUBLIC_PREFIX = '/storage/certificates';

/**
 * Maps a stored pdf_url (or bare file name) to its absolute path inside
 * CERT_STORAGE_DIR, throwing if the result would escape that directory.
 */
export function resolveCertificateFile(pdfUrl: string): string {
  const root = path.resolve(env.CERT_STORAGE_DIR);
  const resolved = path.resolve(root, path.basename(pdfUrl));
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error('Certificate path escapes the storage directory');
  }
  return resolved;
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** RFC 4648 base32 without padding. */
export function toBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = ((value << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return bits > 0 ? out + BASE32_ALPHABET[(value << (5 - bits)) & 31] : out;
}

export interface CertificateData {
  studentName: string;
  studentIdNumber: string;
  eventTitle: string;
  clubName: string;
  issueDate: string;
  serialNumber: string;
}

export class CertificateService {
  /** 'CC-<year>-' plus 16 random bytes in RFC 4648 base32 (26 chars, 128 bits). */
  public static generateSerialNumber(): string {
    return `CC-${new Date().getUTCFullYear()}-${toBase32(crypto.randomBytes(16))}`;
  }

  public static async generateCertificatePdf(
    data: CertificateData,
    verificationUrlBase: string
  ): Promise<{ buffer: Buffer; sha256Hash: string; filePath: string }> {
    const storageDir = env.CERT_STORAGE_DIR;
    osEnsureDir(storageDir);

    const fileName = `${data.serialNumber}.pdf`;
    const filePath = path.join(storageDir, fileName);

    const verifyUrl = `${verificationUrlBase}/verify/${data.serialNumber}`;
    const qrBuffer = await QRCode.toBuffer(verifyUrl, {
      margin: 1,
      width: 100,
      color: { dark: '#000000', light: '#FFFFFF' }
    });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 40
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        fs.writeFileSync(filePath, pdfBuffer);

        const sha256Hash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
        resolve({
          buffer: pdfBuffer,
          sha256Hash,
          filePath: `${CERT_PUBLIC_PREFIX}/${fileName}`
        });
      });
      doc.on('error', reject);

      // Certificate Background Border
      doc.rect(20, 20, 802, 555)
         .lineWidth(3)
         .strokeColor('#1E3A8A')
         .stroke();
      doc.rect(26, 26, 790, 543)
         .lineWidth(1)
         .strokeColor('#94A3B8')
         .stroke();

      // Header
      doc.font('Helvetica-Bold')
         .fontSize(28)
         .fillColor('#0F172A')
         .text('CAMPUSCONNECT', 0, 70, { align: 'center' });

      doc.font('Helvetica')
         .fontSize(12)
         .fillColor('#64748B')
         .text('UNIVERSITY EXTRACURRICULAR ACTIVITIES BOARD', 0, 105, { align: 'center' });

      doc.font('Helvetica-Bold')
         .fontSize(22)
         .fillColor('#1E3A8A')
         .text('CERTIFICATE OF PARTICIPATION', 0, 145, { align: 'center' });

      doc.font('Helvetica')
         .fontSize(14)
         .fillColor('#334155')
         .text('This is to certify that', 0, 195, { align: 'center' });

      // Student Name
      doc.font('Helvetica-Bold')
         .fontSize(24)
         .fillColor('#0F172A')
         .text(data.studentName.toUpperCase(), 0, 225, { align: 'center' });

      doc.font('Helvetica')
         .fontSize(12)
         .fillColor('#64748B')
         .text(`Student Identification: ${data.studentIdNumber}`, 0, 258, { align: 'center' });

      // Event Details
      doc.font('Helvetica')
         .fontSize(14)
         .fillColor('#334155')
         .text(
           `has actively participated in the academic and practical sessions of`,
           0,
           290,
           { align: 'center' }
         );

      doc.font('Helvetica-Bold')
         .fontSize(18)
         .fillColor('#1E3A8A')
         .text(`"${data.eventTitle}"`, 0, 318, { align: 'center' });

      doc.font('Helvetica')
         .fontSize(13)
         .fillColor('#475569')
         .text(`Organized by ${data.clubName} on ${data.issueDate}`, 0, 350, { align: 'center' });

      // Signatures
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor('#0F172A');

      doc.text('_________________________', 100, 450);
      doc.text('Al Imtiaz', 100, 468);
      doc.font('Helvetica').fontSize(9).fillColor('#64748B').text('Course Teacher', 100, 482);

      doc.font('Helvetica-Bold').fontSize(11).fillColor('#0F172A');
      doc.text('_________________________', 600, 450);
      doc.text('Md. Shakhawat Hossain', 600, 468);
      doc.font('Helvetica').fontSize(9).fillColor('#64748B').text('Team Leader', 600, 482);

      // Embedded QR Code
      doc.image(qrBuffer, 371, 420, { width: 100, height: 100 });

      // Verification Footnote
      doc.font('Helvetica')
         .fontSize(8)
         .fillColor('#64748B')
         .text(
           `Serial: ${data.serialNumber} | Tamper-evident digitally signed credential | Verify at: ${verifyUrl}`,
           0,
           530,
           { align: 'center' }
         );

      doc.end();
    });
  }
}

function osEnsureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
