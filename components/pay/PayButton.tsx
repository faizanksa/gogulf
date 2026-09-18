"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { beginPayment } from "@/app/(marketing)/pay/[reference]/actions";
import styles from "./PayButton.module.css";

/**
 * Opens Razorpay Checkout for one invoice.
 *
 * WHAT THIS DOES NOT DO: decide that a payment happened. Checkout's success callback is a
 * message from the payer's own device, so it is only ever used to say "we are confirming"
 * and to start re-reading the page — the status shown afterwards is whatever the server
 * read from the invoice, which only Razorpay's signed webhook can move to paid.
 *
 * checkout.js is loaded only when the payer presses the button, so nothing is requested
 * from Razorpay just by opening the page.
 */

interface CheckoutOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: "INR";
  name: string;
  description: string;
  handler: () => void;
  modal: { ondismiss: () => void };
  theme?: { color: string };
}
declare global {
  interface Window {
    Razorpay?: new (options: CheckoutOptions) => { open: () => void };
  }
}

const SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

function loadCheckout(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
    const script = existing ?? Object.assign(document.createElement("script"), { src: SCRIPT, async: true });
    script.addEventListener("load", () => resolve(true), { once: true });
    script.addEventListener("error", () => resolve(false), { once: true });
    if (!existing) document.head.appendChild(script);
  });
}

const MESSAGES = {
  not_payable: "This invoice can no longer be paid. Please contact us if you think this is a mistake.",
  not_found: "We could not find this invoice.",
  unavailable: "Payment is not available right now. Please try again in a few minutes, or contact us.",
  rate_limited: "Too many attempts. Please wait a minute and try again.",
  script: "The secure payment window could not be loaded. Check your connection and try again.",
} as const;

export function PayButton({ reference, label }: { reference: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const polls = useRef(0);

  // After checkout reports back, re-read the page a few times. The server decides what it
  // says; the poll simply stops once the status is no longer "awaiting" or after a minute.
  useEffect(() => {
    if (!confirming) return;
    const timer = setInterval(() => {
      polls.current += 1;
      router.refresh();
      if (polls.current >= 20) {
        clearInterval(timer);
        setConfirming(false);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [confirming, router]);

  async function pay() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await beginPayment(reference);
      if (!result.ok) {
        setMessage(MESSAGES[result.reason]);
        if (result.reason === "not_payable") router.refresh();
        return;
      }
      if (!(await loadCheckout()) || !window.Razorpay) {
        setMessage(MESSAGES.script);
        return;
      }
      const { checkout } = result;
      new window.Razorpay({
        key: checkout.keyId,
        order_id: checkout.orderId,
        amount: checkout.amountMinor,
        currency: checkout.currency,
        name: "Go Gulf",
        description: `${checkout.reference} — ${checkout.description}`.slice(0, 250),
        theme: { color: "#166534" },
        // The payer's device says it went through. That is not proof; it only starts the re-read.
        handler: () => {
          polls.current = 0;
          setConfirming(true);
          router.refresh();
        },
        modal: { ondismiss: () => setBusy(false) },
      }).open();
    } catch {
      setMessage(MESSAGES.unavailable);
    } finally {
      // Checkout is now open in its own window; the button is usable again if it is closed.
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap}>
      {confirming ? (
        <p className={styles.confirming} role="status">
          Thank you. We are confirming your payment with our payment provider — this page will update by itself. Please do not pay again.
        </p>
      ) : (
        <Button type="button" onClick={pay} loading={busy} fullWidth>
          {busy ? "Opening secure payment…" : label}
        </Button>
      )}
      {message ? (
        <p className={styles.error} role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
