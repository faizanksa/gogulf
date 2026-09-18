"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import styles from "./admin.module.css";

/**
 * The customer payment link and its QR code, for staff to view, copy, print and share.
 *
 * Everything shown is derived from the invoice reference: the link is /pay/<reference>
 * and the QR encodes that same URL — no amount, no secret, no internal id. What the
 * customer sees, and whether they can pay, is decided by that page when it is opened.
 * The link is selectable text as well as a button, so nothing depends on the Clipboard API.
 */
export function PaymentLinkPanel({ url, qrDataUri, reference }: { url: string; qrDataUri: string; reference: string }) {
  const [copied, setCopied] = useState(false);
  const message = `Go Gulf invoice ${reference}: ${url}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Not secure-context or blocked: the link is in the box above, ready to select.
    }
  }

  return (
    <div className={styles.qrBox}>
      <div className={styles.linkRow}>
        <input className={styles.linkInput} readOnly value={url} aria-label="Customer payment link" onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className={styles.pageLink} onClick={copy}>
          {copied ? "Copied" : "Copy link"}
        </button>
        <span className="visually-hidden" role="status">
          {copied ? "Payment link copied" : ""}
        </span>
      </div>

      {/* An <img> of a data URI: it is generated here and never fetched, so next/image would add nothing. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.qrImage} src={qrDataUri} alt={`QR code for the payment page of invoice ${reference}`} width={224} height={224} />

      <ul className={`${styles.inlineLinks} ${styles.noPrint}`}>
        <li>
          <a href={url} target="_blank" rel="noopener noreferrer">
            Open the payment page
          </a>
        </li>
        <li>
          <a href={qrDataUri} download={`${reference}-payment-qr.svg`}>
            Download QR (SVG)
          </a>
        </li>
        <li>
          <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
            Share on WhatsApp
          </a>
        </li>
        <li>
          <a href={`mailto:?subject=${encodeURIComponent(`Invoice ${reference}`)}&body=${encodeURIComponent(message)}`}>Share by email</a>
        </li>
      </ul>
      <div className={styles.noPrint}>
        <Button type="button" variant="secondary" size="sm" onClick={() => window.print()}>
          Print QR code
        </Button>
      </div>
    </div>
  );
}
