import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const CONTACT_TO_EMAIL = Deno.env.get("CONTACT_TO_EMAIL");

// Comma-separated list of origins allowed to call this function, e.g.
// "https://pdfworld.app,http://localhost:8080". Unset means any origin.
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const MAX_LENGTHS = { name: 100, email: 254, subject: 200, message: 5000 };
const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

const buildCorsHeaders = (origin: string | null): Record<string, string> => {
  const allowOrigin =
    ALLOWED_ORIGINS.length === 0
      ? "*"
      : origin && ALLOWED_ORIGINS.includes(origin)
        ? origin
        : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
};

// Every user-supplied value is interpolated into the email HTML, so escape it.
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Strip CR/LF so values used in headers (subject) can't inject extra lines.
const singleLine = (value: string): string => value.replace(/[\r\n]+/g, " ").trim();

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

interface ContactRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = buildCorsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const origin = req.headers.get("origin");
  if (ALLOWED_ORIGINS.length > 0 && origin && !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: "Origin not allowed" }, 403);
  }

  try {
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      return json({ error: "Email service is not configured" }, 500);
    }

    if (!CONTACT_TO_EMAIL) {
      console.error("CONTACT_TO_EMAIL is not configured");
      return json({ error: "Email service is not configured" }, 500);
    }

    let body: Partial<Record<keyof ContactRequest, unknown>>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const name = singleLine(asString(body.name));
    const email = singleLine(asString(body.email));
    const subject = singleLine(asString(body.subject));
    const message = asString(body.message).trim();

    // Validate required fields
    if (!name || !email || !message) {
      return json({ error: "Name, email, and message are required" }, 400);
    }

    if (!EMAIL_RE.test(email)) {
      return json({ error: "Please enter a valid email address" }, 400);
    }

    const tooLong = (Object.keys(MAX_LENGTHS) as (keyof typeof MAX_LENGTHS)[]).find(
      (field) => ({ name, email, subject, message })[field].length > MAX_LENGTHS[field]
    );
    if (tooLong) {
      return json({ error: `The ${tooLong} field is too long` }, 400);
    }

    console.log("Received contact form submission");

    const safe = {
      name: escapeHtml(name),
      email: escapeHtml(email),
      subject: escapeHtml(subject || "No subject"),
      message: escapeHtml(message).replace(/\r?\n/g, "<br />"),
    };

    // Send email using Resend API
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "PDF World <onboarding@resend.dev>",
        to: [CONTACT_TO_EMAIL],
        reply_to: email,
        subject: subject || `Contact from ${name}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 32px 40px; text-align: center;">
                        <!-- Logo -->
                        <div style="margin-bottom: 16px;">
                          <svg width="48" height="48" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block;">
                            <path d="M8 4C8 2.89543 8.89543 2 10 2H24L32 10V36C32 37.1046 31.1046 38 30 38H10C8.89543 38 8 37.1046 8 36V4Z" fill="rgba(255,255,255,0.2)" stroke="#ffffff" stroke-width="2.5"/>
                            <path d="M24 2V10H32" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                            <circle cx="20" cy="24" r="8" fill="rgba(255,255,255,0.15)" stroke="#ffffff" stroke-width="2"/>
                            <path d="M12 24H28" stroke="#ffffff" stroke-width="2"/>
                            <ellipse cx="20" cy="24" rx="4" ry="8" fill="none" stroke="#ffffff" stroke-width="2"/>
                            <path d="M12 13H20" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
                          </svg>
                        </div>
                        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">PDF World</h1>
                        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">New Contact Form Submission</p>
                      </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding-bottom: 20px;">
                              <p style="margin: 0 0 4px; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Name</p>
                              <p style="margin: 0; font-size: 16px; color: #111827; font-weight: 500;">${safe.name}</p>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding-bottom: 20px;">
                              <p style="margin: 0 0 4px; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Email</p>
                              <p style="margin: 0; font-size: 16px;"><a href="mailto:${safe.email}" style="color: #3b82f6; text-decoration: none;">${safe.email}</a></p>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding-bottom: 24px;">
                              <p style="margin: 0 0 4px; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Subject</p>
                              <p style="margin: 0; font-size: 16px; color: #111827; font-weight: 500;">${safe.subject}</p>
                            </td>
                          </tr>
                          <tr>
                            <td style="border-top: 1px solid #e5e7eb; padding-top: 24px;">
                              <p style="margin: 0 0 12px; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Message</p>
                              <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; border-left: 4px solid #3b82f6;">
                                <p style="margin: 0; font-size: 15px; color: #374151; line-height: 1.6;">${safe.message}</p>
                              </div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="margin: 0; font-size: 13px; color: #6b7280;">This email was sent from the PDF World contact form.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      console.error("Resend API error:", res.status, errorData);
      return json({ error: "Failed to send email" }, 502);
    }

    console.log("Email sent successfully");

    return json({ success: true, message: "Email sent successfully" }, 200);
  } catch (error: unknown) {
    // Log details server-side only; don't leak internals to the caller.
    console.error("Error sending contact email:", error);
    return json({ error: "Failed to send email" }, 500);
  }
};

serve(handler);
