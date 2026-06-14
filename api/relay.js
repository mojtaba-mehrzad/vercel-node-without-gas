// Vercel Edge Serverless - Direct mhrv-rs Node
export const config = { runtime: 'edge' };

const AUTH_KEY = "KG,u~=8)E46Q2.Mu>k#huy1Hbmfmi^!%46z.jAx+1YC}q~@Cd-?G-MKm6mgpC]!FL]UQ-V5ZKtm=_zn>K#P>XEUNE+)}aJe@#G4W";

const BLOCKED_KEYWORDS = ["graph.facebook.com", "analytics", "telemetry", "stats.telegram.org", "ads.", "logging", "app-measurement.com"];
const STRIP_HEADERS = new Set(["host", "connection", "content-length", "transfer-encoding", "proxy-connection", "proxy-authorization", "x-forwarded-for", "via"]);

function isBlocked(url) {
  if (!url) return false;
  return BLOCKED_KEYWORDS.some(k => url.toLowerCase().includes(k));
}

function bytesToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) { binary += String.fromCharCode(bytes[i]); }
  return btoa(binary);
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export default async function handler(request) {
  if (request.method !== "POST") return new Response("mhrv Vercel Edge Node Active", { status: 200 });

  try {
    const body = await request.json();
    if (body.k !== AUTH_KEY) return Response.json({ e: "unauthorized" }, { status: 401 });

    if (Array.isArray(body.q)) {
      const results = await Promise.all(body.q.map(item => processRequest(item)));
      return Response.json({ q: results });
    }
    
    return await processRequest(body, true);
  } catch (err) {
    return Response.json({ e: String(err) }, { status: 500 });
  }
}

async function processRequest(req, isSingle = false) {
  if (!req.u || !/^https?:\/\//i.test(req.u)) {
    return isSingle ? Response.json({ e: "bad url" }) : { e: "bad url" };
  }
  
  if (isBlocked(req.u)) {
    const emptyResp = { s: 200, h: {}, b: "" };
    return isSingle ? Response.json(emptyResp) : emptyResp;
  }

  const method = (req.m || "GET").toUpperCase();
  const outHeaders = new Headers();
  if (req.h) {
    for (const [k, v] of Object.entries(req.h)) {
      if (!STRIP_HEADERS.has(k.toLowerCase())) outHeaders.set(k, String(v));
    }
  }

  let payload = undefined;
  if (req.b && req.b.length > 0) payload = base64ToBytes(req.b);

  const fetchOptions = { method, headers: outHeaders, body: payload, redirect: "manual" };
  const resp = await fetch(req.u, fetchOptions);
  const data = await resp.arrayBuffer();

  const respHeaders = {};
  resp.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === "content-encoding" || lower === "content-length") return;
    respHeaders[key] = value;
  });

  if (typeof resp.headers.getSetCookie === "function") {
    const cookies = resp.headers.getSetCookie();
    if (cookies && cookies.length > 0) respHeaders["set-cookie"] = cookies;
  }

  const resultObj = { s: resp.status, h: respHeaders, b: bytesToBase64(data) };

  // 🌟 مکانیزم کش هوشمند Vercel CDN با استفاده از هدرهای کنترل
  if (isSingle) {
    const isStatic = req.u.match(/\.(png|jpg|jpeg|gif|webp|ico|css|woff2?|tgs)$/i) && !req.u.includes("/cdn-cgi/");
    const resOptions = { status: 200, headers: { "Content-Type": "application/json" } };
    
    if (method === "GET" && isStatic && resp.status === 200) {
      // s-maxage به Vercel Edge می‌گوید این پاسخ را 2 ساعت برای بقیه درخواست‌ها نگه دار
      resOptions.headers["Cache-Control"] = "public, s-maxage=7200, stale-while-revalidate=86400";
    }
    return Response.json(resultObj, resOptions);
  }

  return resultObj;
}