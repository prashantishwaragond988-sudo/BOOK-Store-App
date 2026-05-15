import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function run(cmd, args, options) {
  return spawnSync(cmd, args, { stdio: 'inherit', ...options });
}

function writeEmptyManifest(manifestPath) {
  const manifest = {
    generatedAt: new Date().toISOString(),
    bookIds: [],
    orderIds: [],
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

async function main() {
  const manifestPath = path.resolve(process.cwd(), '.static-export-manifest.json');

  if (fs.existsSync(manifestPath)) return;

  const generatorPath = path.resolve(process.cwd(), '..', 'backend', 'generate_static_export_manifest.py');
  if (!fs.existsSync(generatorPath)) {
    writeEmptyManifest(manifestPath);
    return;
  }

  const args = [generatorPath, '--out', manifestPath];

  const booksLimit = process.env.STATIC_EXPORT_BOOKS_LIMIT;
  if (booksLimit) args.push('--books-limit', String(booksLimit));

  const includeOrders = process.env.STATIC_EXPORT_INCLUDE_ORDERS;
  if (includeOrders && includeOrders !== '0' && includeOrders.toLowerCase() !== 'false') {
    args.push('--include-orders');
    const ordersLimit = process.env.STATIC_EXPORT_ORDERS_LIMIT;
    if (ordersLimit) args.push('--orders-limit', String(ordersLimit));
  }

  const tryCommands = ['python', 'python3'];
  for (const cmd of tryCommands) {
    const res = run(cmd, args);
    if (res.status === 0 && fs.existsSync(manifestPath)) return;
  }

  // If generation failed (missing python, missing creds, network blocked), keep build going.
  writeEmptyManifest(manifestPath);
}

main().catch(() => process.exit(0));

