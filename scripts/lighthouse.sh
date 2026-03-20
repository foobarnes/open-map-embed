#!/usr/bin/env bash
#
# Run Lighthouse against the preview server and print key metrics.
# Usage:
#   pnpm perf          # default: http://localhost:4173
#   pnpm perf <url>    # custom URL
#
# Saves full JSON report to .lighthouse/ for diffing across runs.

set -euo pipefail

URL="${1:-http://localhost:4173}"
DIR=".lighthouse"
mkdir -p "$DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUTFILE="$DIR/report-$TIMESTAMP.json"

echo "Running Lighthouse against $URL ..."
echo ""

pnpm dlx lighthouse "$URL" \
  --output=json \
  --output-path="$OUTFILE" \
  --only-categories=performance \
  --chrome-flags="--headless=new --no-sandbox" \
  --quiet 2>/dev/null

# Extract key metrics with node (available since we're in a node project)
node -e "
const r = require('./$OUTFILE');
const a = r.audits;
const score = Math.round(r.categories.performance.score * 100);

const metrics = [
  ['Performance Score', score + '/100'],
  ['First Contentful Paint', a['first-contentful-paint'].displayValue],
  ['Largest Contentful Paint', a['largest-contentful-paint'].displayValue],
  ['Total Blocking Time', a['total-blocking-time'].displayValue],
  ['Cumulative Layout Shift', a['cumulative-layout-shift'].displayValue],
  ['Speed Index', a['speed-index'].displayValue],
];

const pad = 28;
console.log('='.repeat(50));
metrics.forEach(([k, v]) => console.log(k.padEnd(pad) + v));
console.log('='.repeat(50));
console.log('Full report: $OUTFILE');
"
