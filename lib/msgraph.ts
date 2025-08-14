type SendGraphMailInput = {
  to: string | string[];
  subject: string;
  html: string;
  from?: string; // defaults to EMAIL_SENDER_ADDRESS
  cc?: string[];
  bcc?: string[];
};

const TENANT_ID = process.env.MS_TENANT_ID as string;
const CLIENT_ID = process.env.MS_CLIENT_ID as string;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET as string;
const DEFAULT_FROM = (process.env.EMAIL_SENDER_ADDRESS || process.env.SENDER_EMAIL) as string;

if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
  // Do not throw at import time to avoid breaking build if envs are missing during typecheck
  // We'll validate at call time instead.
}

async function getAccessToken(): Promise<string> {
  const params = new URLSearchParams();
  params.append("client_id", CLIENT_ID);
  params.append("client_secret", CLIENT_SECRET);
  params.append("scope", "https://graph.microsoft.com/.default");
  params.append("grant_type", "client_credentials");

  const url = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MS Graph token error: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function sendGraphMail(input: SendGraphMailInput): Promise<void> {
  const { subject, html } = input;
  const to = Array.isArray(input.to) ? input.to : [input.to];
  const cc = input.cc ?? [];
  const bcc = input.bcc ?? [];
  const from = input.from || DEFAULT_FROM;

  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Missing MS Graph env vars: MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET");
  }
  if (!from) {
    throw new Error("Missing EMAIL_SENDER_ADDRESS (or SENDER_EMAIL) for Graph send");
  }

  const token = await getAccessToken();

  const endpoint = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`;

  const message = {
    subject,
    body: {
      contentType: "HTML",
      content: html,
    },
    toRecipients: to.map((address) => ({ emailAddress: { address } })),
    ccRecipients: cc.map((address) => ({ emailAddress: { address } })),
    bccRecipients: bcc.map((address) => ({ emailAddress: { address } })),
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, saveToSentItems: true }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MS Graph sendMail error: ${res.status} ${text}`);
  }
}

export type { SendGraphMailInput };
