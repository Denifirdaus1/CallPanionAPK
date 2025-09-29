#!/usr/bin/env node
// Lightweight Tavily search CLI for Codex (no deps)
// Usage:
//   node scripts/tavily-search.mjs "your query" [--max-results 5] [--search-depth advanced] [--include-domains a.com,b.com] [--exclude-domains x.com]
//   Add --json to print raw JSON.

const HELP = `Tavily Search (no-deps)

Usage:
  node scripts/tavily-search.mjs "<query>" [options]

Options:
  --query               Query text (can also pass as first positional)
  --search-depth        basic | advanced (default: basic)
  --max-results         Number of results (default: 5)
  --include-domains     Comma-separated allowlist (e.g., docs.flutter.dev,react.dev)
  --exclude-domains     Comma-separated blocklist
  --topic               general | news (default: general)
  --days                Lookback days for news (optional)
  --include-answer      true | false (default: true)
  --include-raw-content true | false (default: false)
  --api-key             Override env TAVILY_API_KEY
  --timeout             Seconds (default: 60)
  --json                Print raw JSON response
  --help                Show help

Env:
  TAVILY_API_KEY        API key from Tavily dashboard
`;

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { args.help = true; continue; }
    if (a === '--json') { args.json = true; continue; }
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next == null || next.startsWith('--')) { args[key] = true; continue; }
      args[key] = next; i++;
    } else {
      args._.push(a);
    }
  }
  return args;
}

function toBool(v, def) {
  if (v === undefined) return def;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  if (['1','true','yes','y'].includes(s)) return true;
  if (['0','false','no','n'].includes(s)) return false;
  return def;
}

function toInt(v, def) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : def; }

function splitList(v) {
  if (!v) return undefined;
  return String(v)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { console.log(HELP); process.exit(0); }

  const query = args.query ?? args._[0];
  if (!query) {
    console.error('Error: query is required.\n');
    console.error(HELP);
    process.exit(1);
  }

  const apiKey = args['api-key'] || process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.error('Error: TAVILY_API_KEY is not set. Set env or pass --api-key.');
    process.exit(1);
  }

  const payload = {
    api_key: apiKey,
    query,
    search_depth: (args['search-depth'] ?? 'basic'),
    max_results: toInt(args['max-results'], 5),
    include_domains: splitList(args['include-domains']),
    exclude_domains: splitList(args['exclude-domains']),
    topic: (args.topic ?? 'general'),
    days: args.days ? toInt(args.days, undefined) : undefined,
    include_answer: toBool(args['include-answer'], true),
    include_raw_content: toBool(args['include-raw-content'], false),
  };

  // Remove undefined keys to keep body clean
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

  const controller = new AbortController();
  const timeoutMs = toInt(args.timeout, 60) * 1000;
  const t = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(t);
    if (err.name === 'AbortError') {
      console.error(`Request timed out after ${timeoutMs / 1000}s`);
      process.exit(1);
    }
    console.error('Network error:', err.message || String(err));
    process.exit(1);
  }

  clearTimeout(t);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`HTTP ${res.status}: ${res.statusText}`);
    if (text) console.error(text);
    process.exit(1);
  }

  const data = await res.json();
  if (args.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  printPretty(data);
}

function printPretty(data) {
  const { answer, results } = data;
  if (answer) {
    console.log('Answer:');
    console.log(wrap(answer, 100));
    console.log('');
  }
  if (Array.isArray(results) && results.length) {
    console.log('Results:');
    results.forEach((r, i) => {
      const title = r.title || r.url || `Result ${i+1}`;
      console.log(`- ${title}`);
      if (r.url) console.log(`  ${r.url}`);
      if (r.content) console.log(`  ${truncate(r.content.replace(/\s+/g, ' ').trim(), 180)}`);
    });
  } else {
    console.log('No results.');
  }
}

function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

function wrap(text, width) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > width) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = line ? line + ' ' + w : w;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

main().catch(err => {
  console.error('Unexpected error:', err?.stack || err?.message || String(err));
  process.exit(1);
});

