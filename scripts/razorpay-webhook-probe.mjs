/**
 * Prove the Razorpay webhook endpoint behaves, against a running server.
 *
 *   node scripts/razorpay-webhook-probe.mjs --base=http://127.0.0.1:3100 --secret=whsec_local_test
 *   node scripts/razorpay-webhook-probe.mjs --base=https://staging.gogulf.co          # expects 503 until configured
 *
 * Sends: a correctly signed event, the same event id again (replay), a body altered
 * after signing, an unsigned request, a body that is not JSON, and one that is JSON
 * but not an event. Prints one line per case with the status code and the outcome the
 * endpoint reported.
 *
 * SAFETY
 *   - Never prints the secret or a signature.
 *   - Sends only synthetic order/payment ids (`order_PROBE…`), which match no real
 *     payment, so a run against a configured environment records ignored events and
 *     changes no money state.
 *   - Uses the secret passed on the command line, never a live credential from a file.
 *   - Against any origin that is not local or staging, refuses --secret, --order and
 *     --failed-order outright: production only ever gets the unsigned probe.
 */

import { createHmac, randomUUID } from "node:crypto";
import { getStagingBypass, STAGING_ORIGIN } from "./perf/vercel-bypass.mjs";

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`)) ?? `--${name}=${fallback ?? ""}`).split("=").slice(1).join("=");

const base = arg("base", "http://127.0.0.1:3100").replace(/\/$/, "");
const secret = arg("secret", "");
const url = `${base}/api/razorpay/webhook`;

// With no --order, the probe uses an order id that matches no payment: every
// delivery is then recorded and `ignored`, which proves the HTTP and signature
// layers without touching a real payment. Pass --order to drive an actual payment
// row through authorized → paid, and --failed-order to drive one to failed.
const orderId = arg("order", "order_PROBE000000001");
const failedOrderId = arg("failed-order", orderId);

// Anything that is not this machine or staging is treated as production. There, the
// only permitted probe is the unsigned one: it proves the endpoint is deployed and
// closed (401/503) and cannot reach the database. A signed probe with the live secret
// would write events into production, and with --order it would mark a real payment
// paid or failed without any money moving. No flag overrides this.
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base);
if (!isLocal && !base.startsWith(STAGING_ORIGIN) && (secret || process.argv.some((a) => /^--(failed-)?order=/.test(a)))) {
  console.error(
    `Refusing: ${base} is not local or staging. Against production only the unsigned probe runs —\n` +
      "drop --secret, --order and --failed-order. It never signs or drives a production payment.",
  );
  process.exit(1);
}

// Staging sits behind Vercel deployment protection, which answers 401 to anything
// without the bypass header. Without this, every probe result would be the wall's
// answer rather than the endpoint's — a test that passes while proving nothing.
const bypass = base.startsWith(STAGING_ORIGIN) ? await getStagingBypass() : null;

const sign = (body) => createHmac("sha256", secret).update(body, "utf8").digest("hex");

const event = (type, extra = {}, order = orderId) =>
  JSON.stringify({
    entity: "event",
    event: type,
    payload: {
      payment: {
        entity: {
          id: `pay_PROBE${Math.floor(Math.random() * 1e6)}`,
          order_id: order,
          amount: 500000,
          currency: "INR",
          method: "upi",
          ...extra,
        },
      },
    },
  });

const post = async (label, { body, signature, eventId }) => {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(bypass ? { "x-vercel-protection-bypass": bypass } : {}),
      ...(signature ? { "x-razorpay-signature": signature } : {}),
      ...(eventId ? { "x-razorpay-event-id": eventId } : {}),
    },
    body,
  });
  let outcome = "";
  try {
    const json = await res.json();
    outcome = `${json.status ?? ""}${json.outcome ? ` / ${json.outcome}` : ""}`;
  } catch {
    outcome = "(no json body)";
  }
  console.log(`  ${String(res.status).padEnd(4)} ${label.padEnd(44)} ${outcome}`);
  return res.status;
};

console.log(`Probing ${url}${secret ? "" : "  (no --secret given: expecting 503 or 401 only)"}\n`);

const authorized = event("payment.authorized");
const paid = event("order.paid");
const replayId = `evt_PROBE_${randomUUID()}`;
const results = {};

results.authorized = await post("signed payment.authorized", { body: authorized, signature: secret ? sign(authorized) : undefined, eventId: `evt_PROBE_${randomUUID()}` });
results.signed = await post("signed order.paid", { body: paid, signature: secret ? sign(paid) : undefined, eventId: replayId });
results.replay = await post("same event id again (replay)", { body: paid, signature: secret ? sign(paid) : undefined, eventId: replayId });

const tampered = paid.replace("500000", "100000");
results.tampered = await post("body altered after signing", { body: tampered, signature: secret ? sign(paid) : undefined, eventId: `evt_PROBE_${randomUUID()}` });

results.unsigned = await post("no signature header", { body: paid, eventId: `evt_PROBE_${randomUUID()}` });
results.wrongSecret = await post("signed with a different secret", {
  body: paid,
  signature: createHmac("sha256", "not-the-secret").update(paid, "utf8").digest("hex"),
  eventId: `evt_PROBE_${randomUUID()}`,
});

results.noEventId = await post("signed, but no event id header", { body: paid, signature: secret ? sign(paid) : undefined });

const notJson = "{not json";
results.notJson = await post("signed body that is not JSON", { body: notJson, signature: secret ? sign(notJson) : undefined, eventId: `evt_PROBE_${randomUUID()}` });

const notEvent = JSON.stringify({ hello: "world" });
results.notEvent = await post("signed JSON that is not an event", { body: notEvent, signature: secret ? sign(notEvent) : undefined, eventId: `evt_PROBE_${randomUUID()}` });

const failed = event("payment.failed", { error_code: "BAD_REQUEST_ERROR", error_description: "probe" }, failedOrderId);
results.failed = await post("signed payment.failed", { body: failed, signature: secret ? sign(failed) : undefined, eventId: `evt_PROBE_${randomUUID()}` });

console.log("");
if (!secret) {
  // With no secret to sign with, the only meaningful question is whether the
  // endpoint is deployed and closed. 503 means deployed and not yet configured;
  // 401 everywhere means it is configured (and correctly refusing unsigned input).
  const all = Object.values(results);
  if (all.every((s) => s === 503)) {
    console.log("PASS — deployed, and not configured yet: every delivery is deferred with 503.");
    process.exit(0);
  }
  if (all.every((s) => s === 401)) {
    console.log("PASS — deployed and configured: unsigned and wrongly signed requests are refused with 401.");
    process.exit(0);
  }
  console.log("FAIL — mixed statuses for an unsigned probe; the endpoint is neither cleanly unconfigured nor cleanly closed.");
  process.exit(1);
}

const expected = {
  authorized: 200,
  signed: 200,
  replay: 200,
  tampered: 401,
  unsigned: 401,
  wrongSecret: 401,
  noEventId: 400,
  notJson: 400,
  notEvent: 400,
  failed: 200,
};
const wrong = Object.entries(expected).filter(([k, v]) => results[k] !== v);
for (const [k, v] of wrong) console.log(`  expected ${v} for ${k}, got ${results[k]}`);
console.log(wrong.length === 0 ? "PASS — signature, replay and malformed-input handling all behave." : "FAIL — see above.");
process.exit(wrong.length === 0 ? 0 : 1);
