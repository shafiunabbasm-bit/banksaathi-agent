import { db } from "hatchable";
export const access = "public";
export const methods = ["POST"];

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export default async function (req, res) {
  const b = req.body || {};
  const paymentId = String(b.razorpay_payment_id || "");
  const returnedOrderId = String(b.razorpay_order_id || "");
  const signature = String(b.razorpay_signature || "");
  const applicationId = String(b.application_id || "");

  if (!paymentId || !returnedOrderId || !signature || !applicationId) {
    return res.status(400).json({ message: "Payment verification data अधूरा है" });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !secret) {
    return res.status(503).json({ configured: false, message: "Razorpay credentials configure नहीं हैं" });
  }

  const q = await db.query(
    "SELECT id,payment_order_id FROM applications WHERE id=$1 LIMIT 1",
    [applicationId]
  );
  if (!q.rows?.length) return res.status(404).json({ message: "Application नहीं मिली" });

  const storedOrderId = String(q.rows[0].payment_order_id || "");
  if (!storedOrderId || storedOrderId !== returnedOrderId) {
    return res.status(400).json({ message: "Order ID mismatch" });
  }

  const expected = await hmacHex(secret, storedOrderId + "|" + paymentId);
  if (expected !== signature) {
    return res.status(400).json({ verified: false, message: "Payment signature verification failed" });
  }

  const rp = await fetch(
    "https://api.razorpay.com/v1/orders/" + encodeURIComponent(storedOrderId) + "/payments",
    { headers: { "Authorization": "Basic " + btoa(keyId + ":" + secret) } }
  );
  const data = await rp.json().catch(() => ({}));
  if (!rp.ok) {
    return res.status(502).json({ message: "Razorpay payment status check failed", details: data });
  }

  const payment = (data.items || []).find(x => x.id === paymentId);
  const captured = payment?.status === "captured";

  if (captured) {
    await db.query(
      "UPDATE applications SET payment_status='Paid',status='Payment Received',payment_id=$1 WHERE id=$2 AND payment_order_id=$3",
      [paymentId, applicationId, storedOrderId]
    );
  }

  res.json({
    verified: true,
    paid: captured,
    payment_id: paymentId,
    order_id: storedOrderId,
    application_id: applicationId,
    payment_status: payment?.status || "unknown"
  });
}