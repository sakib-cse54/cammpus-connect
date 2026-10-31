import crypto from 'crypto';
import QRCode from 'qrcode';
import { env } from '../config/env.js';

const ROTATION_WINDOW_SECONDS = 20;
const QR_SECRET = env.QR_HMAC_SECRET;

export class QrService {
  public static getCurrentSlot(): number {
    return Math.floor(Date.now() / 1000 / ROTATION_WINDOW_SECONDS);
  }

  public static generateDynamicToken(eventId: string, slot?: number): string {
    const targetSlot = slot ?? this.getCurrentSlot();
    const payload = `${eventId}:${targetSlot}`;
    const hmac = crypto.createHmac('sha256', QR_SECRET);
    hmac.update(payload);
    return `${targetSlot}:${hmac.digest('hex').substring(0, 32)}`;
  }

  public static verifyDynamicToken(token: string, eventId: string): boolean {
    if (!token || !token.includes(':')) return false;
    const parts = token.split(':');
    if (parts.length !== 2) return false;

    const tokenSlot = parseInt(parts[0], 10);
    const tokenHash = parts[1];
    if (isNaN(tokenSlot)) return false;

    // Only the current slot and the previous one are accepted (max ~40 s old).
    if (!QrService.isAcceptedSlot(tokenSlot)) return false;

    const expectedHmac = crypto.createHmac('sha256', QR_SECRET);
    expectedHmac.update(`${eventId}:${tokenSlot}`);
    const expectedHash = expectedHmac.digest('hex').substring(0, 32);

    const tokenBuf = Buffer.from(tokenHash);
    const expectedBuf = Buffer.from(expectedHash);
    if (tokenBuf.length !== expectedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(tokenBuf, expectedBuf);
  }

  /** Current slot or the one before it; future slots are never accepted. */
  public static isAcceptedSlot(slot: number): boolean {
    const diff = QrService.getCurrentSlot() - slot;
    return diff === 0 || diff === 1;
  }

  /** 6-digit fallback code derived from a separate HMAC domain for (event, slot). */
  public static generateShortCode(eventId: string, slot?: number): string {
    const targetSlot = slot ?? QrService.getCurrentSlot();
    const digest = crypto.createHmac('sha256', QR_SECRET).update(`short:${eventId}:${targetSlot}`).digest();
    return String(digest.readUInt32BE(0) % 1_000_000).padStart(6, '0');
  }

  /** Accepts a short code for the current or previous slot (constant-time compare). */
  public static verifyShortCode(code: string, eventId: string): boolean {
    if (!/^\d{6}$/.test(code)) return false;
    const current = QrService.getCurrentSlot();
    return [current, current - 1].some((slot) =>
      crypto.timingSafeEqual(Buffer.from(QrService.generateShortCode(eventId, slot)), Buffer.from(code)));
  }

  /** Deep link encoded in the projected QR; opens the client's check-in page. */
  public static buildCheckInUrl(baseUrl: string, eventId: string, token: string): string {
    const base = baseUrl.replace(/\/+$/, '');
    return `${base}/checkin/${encodeURIComponent(eventId)}?t=${encodeURIComponent(token)}`;
  }

  public static async generateQrDataUrl(content: string): Promise<string> {
    return await QRCode.toDataURL(content, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 280,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
  }
}
