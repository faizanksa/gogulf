/**
 * The QR code for a customer payment page.
 *
 * It encodes ONE thing: the public payment URL (https://<site>/pay/GG-INV-2026-00001).
 * No amount, no secret, no internal id, no payment state — scanning it is the same as
 * opening the link, and the page itself decides what to show and whether a payment can be
 * started. It is generated here, on the server, by a bundled library: nothing is sent to a
 * QR-code service, so the payment reference never leaves our own infrastructure.
 *
 * Returned as an SVG data URI so it can be shown, downloaded and printed without
 * injecting markup into the page.
 */

import "server-only";

import QRCode from "qrcode";

export async function paymentQrDataUri(url: string): Promise<string> {
  const svg = await QRCode.toString(url, {
    type: "svg",
    // Level M tolerates a smudged print and still scans from a phone across a desk.
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
