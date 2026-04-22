const fs = require('fs');
const path = require('path');

const outputDir = path.join(process.cwd(), 'perf-ab', 'output');
const files = fs.readdirSync(outputDir)
  .filter((n) => /^local-current-\d{4}-.*\.json$/i.test(n))
  .map((name) => {
    const fullPath = path.join(outputDir, name);
    return { name, fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
  })
  .sort((a, b) => b.mtimeMs - a.mtimeMs);

if (!files.length) {
  console.error('Nenhum arquivo local-current-*.json encontrado em perf-ab/output');
  process.exit(1);
}

const latest = files[0];
const data = JSON.parse(fs.readFileSync(latest.fullPath, 'utf8'));
const flows = Array.isArray(data.flows) ? data.flows : [];

const appRouteRe = /^https?:\/\/localhost:3000(?:\/$|\/(?:login|conversations|kanban|chat|api)(?:[/?]|$))/i;
const authRe = /\/auth\/v1\/(token|user|session)/i;
const restRe = /\/rest\/v1\//i;

function cleanEndpoint(urlLike) {
  try {
    const u = new URL(urlLike);
    return `${u.origin}${u.pathname}`;
  } catch {
    return urlLike || '';
  }
}

function isRelevantRequest(req) {
  const u = String(req.url || req.endpoint || '');
  return authRe.test(u) || restRe.test(u) || appRouteRe.test(u);
}

const endpointAgg = { app: new Map(), supabase: new Map() };

function addEndpoint(source, req) {
  const key = cleanEndpoint(req.url || req.endpoint || '');
  if (!key) return;
  const map = endpointAgg[source];
  const prev = map.get(key) || {
    endpoint: key,
    source,
    calls: 0,
    totalDurationMs: 0,
    maxDurationMs: 0,
    totalPayloadBytes: 0,
  };
  const dur = Number(req.durationMs || 0);
  const payload = Number(req.payloadBytes || 0);
  prev.calls += 1;
  prev.totalDurationMs += dur;
  prev.maxDurationMs = Math.max(prev.maxDurationMs, dur);
  prev.totalPayloadBytes += payload;
  map.set(key, prev);
}

const flowSummaries = flows.map((flow) => {
  const waterfall = Array.isArray(flow.waterfall) ? flow.waterfall : [];

  const totalMs = Number(flow.totalMs ?? 0);
  const documentTTFBMs = Number(flow.documentTTFBMs ?? (waterfall.find((r) => r.resourceType === 'document')?.ttfbMs || 0));
  const totalRequests = Number(flow.totalRequests ?? waterfall.length);
  const peakConcurrency = Number(flow.peakConcurrency ?? 0);

  let largestPayload = flow.largestPayload;
  if (!largestPayload && waterfall.length) {
    const maxReq = waterfall.reduce((a, b) => (Number(a.payloadBytes || 0) >= Number(b.payloadBytes || 0) ? a : b));
    largestPayload = {
      endpoint: maxReq.endpoint,
      url: maxReq.url,
      method: maxReq.method,
      bytes: Number(maxReq.payloadBytes || 0),
      bytesHuman: maxReq.payloadHuman || null,
    };
  }

  const relevantRequests = waterfall
    .filter(isRelevantRequest)
    .sort((a, b) => Number(a.startedOffsetMs || 0) - Number(b.startedOffsetMs || 0))
    .map((r) => ({
      startedOffsetMs: Number(r.startedOffsetMs || 0),
      method: r.method,
      url: r.url || r.endpoint,
      status: r.status,
      durationMs: Number(r.durationMs || 0),
      ttfbMs: Number(r.ttfbMs || 0),
      resourceType: r.resourceType || null,
      parallelMode: r.parallelMode || null,
      parallelAtStart: Number(r.parallelAtStart || 0),
    }));

  const authCalls = { token: 0, user: 0, session: 0 };
  for (const r of waterfall) {
    const u = String(r.url || r.endpoint || '');
    if (/\/auth\/v1\/token/i.test(u)) authCalls.token += 1;
    if (/\/auth\/v1\/user/i.test(u)) authCalls.user += 1;
    if (/\/auth\/v1\/session/i.test(u)) authCalls.session += 1;

    if (/^https?:\/\/localhost:3000/i.test(u)) addEndpoint('app', r);
    if (/supabase|\/auth\/v1|\/rest\/v1/i.test(u)) addEndpoint('supabase', r);
  }

  return {
    flow: flow.flow || null,
    totalMs,
    documentTTFBMs,
    totalRequests,
    dataRequests: Number(flow.dataRequests ?? relevantRequests.length),
    peakConcurrency,
    largestPayload,
    authCalls: { ...authCalls, total: authCalls.token + authCalls.user + authCalls.session },
    relevantDataRequests: relevantRequests,
  };
});

function finalizeEndpointList(map) {
  return [...map.values()]
    .map((x) => ({
      ...x,
      meanDurationMs: x.calls ? Number((x.totalDurationMs / x.calls).toFixed(2)) : 0,
      totalDurationMs: Number(x.totalDurationMs.toFixed(2)),
      maxDurationMs: Number(x.maxDurationMs.toFixed(2)),
    }))
    .sort((a, b) => b.totalDurationMs - a.totalDurationMs);
}

const summary = {
  generatedAt: new Date().toISOString(),
  sourceFile: latest.fullPath,
  flowCount: flowSummaries.length,
  flows: flowSummaries,
  endpointStatsByDuration: {
    app: finalizeEndpointList(endpointAgg.app),
    supabase: finalizeEndpointList(endpointAgg.supabase),
  },
};

const outPath = path.join(outputDir, 'local-current-summary.json');
fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

console.log(`Arquivo salvo: ${outPath}`);
for (const f of flowSummaries) {
  const lp = Number(f.largestPayload?.bytes || 0);
  console.log(`${f.flow}: totalMs=${f.totalMs.toFixed(2)} | docTTFB=${f.documentTTFBMs.toFixed(2)} | req=${f.totalRequests} | dataReq=${f.dataRequests} | peakConc=${f.peakConcurrency} | auth(token/user/session)=${f.authCalls.token}/${f.authCalls.user}/${f.authCalls.session} | largestPayload=${lp}B`);
}
