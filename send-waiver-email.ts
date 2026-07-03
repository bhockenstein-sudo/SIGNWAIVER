// ============================================================
//  True Wild Coastal  ·  send-waiver-email
//  Place this file at:  supabase/functions/send-waiver-email/index.ts
//
//  It emails each signed waiver to the operator inbox and sends the
//  guest their own copy, with the PDF attached. It is triggered by a
//  Database Webhook on INSERT into public.waivers.
//
//  Email is sent through Resend (resend.com). Set these secrets:
//    RESEND_API_KEY   your Resend API key
//    WAIVER_INBOX     waivers@truewildcoastal.com
//    WAIVER_FROM      True Wild Coastal <waivers@truewildcoastal.com>
//    HOOK_SECRET      any long random string (also set on the webhook)
// ============================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const INBOX = Deno.env.get("WAIVER_INBOX") ?? "waivers@truewildcoastal.com";
const FROM  = Deno.env.get("WAIVER_FROM")  ?? "True Wild Coastal <waivers@truewildcoastal.com>";
const HOOK_SECRET = Deno.env.get("HOOK_SECRET") ?? "";

function yymmdd(iso: string){
  const [y, m, d] = (iso || "").split("-");
  return (y ? y.slice(2) : "") + (m || "") + (d || "");
}

async function sendEmail(to: string[], subject: string, html: string, pdfB64: string, filename: string){
  const attachments = pdfB64 ? [{ filename, content: pdfB64 }] : [];
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html, attachments }),
  });
  if (!res.ok) console.error("Resend error:", await res.text());
}

serve(async (req) => {
  try {
    // Optional shared-secret check so only your webhook can call this
    if (HOOK_SECRET && req.headers.get("x-hook-secret") !== HOOK_SECRET) {
      return new Response("unauthorized", { status: 401 });
    }

    const body = await req.json();
    const r = body.record ?? body;
    if (!r || !r.full_name) return new Response("no record", { status: 400 });

    const pdfB64 = ((r.pdf || "").split(",")[1]) || "";
    const safeName = (r.full_name || "guest").replace(/\s+/g, "");
    const filename = `TrueWild_Waiver_${safeName}_${r.signed_date}.pdf`;
    const minors = Array.isArray(r.minors) ? r.minors.join(", ") : "";

    // 1) Operator copy, subject: WAIVER YYMMDD Name
    const opSubject = `WAIVER ${yymmdd(r.signed_date)} ${r.full_name}`;
    const opHtml = `
      <h2 style="font-family:Georgia,serif">New signed waiver</h2>
      <p><strong>${r.full_name}</strong> signed on ${r.signed_date}.</p>
      <ul>
        <li>Email: ${r.email || "-"}</li>
        <li>Phone: ${r.phone || "-"}</li>
        <li>Emergency: ${r.emg_name || "-"} (${r.emg_rel || "-"}) ${r.emg_phone || ""}</li>
        <li>Media consent: ${r.media === "yes" ? "Yes" : "No, do not use image"}</li>
        ${minors ? `<li>Signing for minors: ${minors}</li>` : ""}
        <li>How did you hear: ${r.referral || "Not provided"}</li>
        <li>Newsletter opt-in: ${r.newsletter ? "Yes" : "No"}</li>
      </ul>
      <p>The signed PDF is attached.</p>`;
    await sendEmail([INBOX], opSubject, opHtml, pdfB64, filename);

    // 2) Guest copy
    if (r.email && /\S+@\S+\.\S+/.test(r.email)) {
      const first = (r.full_name || "").split(" ")[0];
      const guestHtml = `
        <p>Hi ${first},</p>
        <p>Thank you for signing your waiver with True Wild Coastal. A copy is attached for your records.</p>
        <p>We look forward to getting you out on the water.</p>
        <p>True Wild Coastal<br/>Nature, Unfiltered.</p>`;
      await sendEmail([r.email], "Your True Wild Coastal waiver", guestHtml, pdfB64, filename);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
