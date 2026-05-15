import fs from 'fs';
import path from 'path';

async function main() {
  const outDir = path.resolve(process.cwd(), 'out');
  const backendBuildDir = path.resolve(process.cwd(), '..', 'backend', 'build');

  if (!fs.existsSync(outDir)) {
    throw new Error(`Missing ${outDir}. Run \`npm run build\` first.`);
  }

  await fs.promises.rm(backendBuildDir, { recursive: true, force: true });
  await fs.promises.mkdir(path.dirname(backendBuildDir), { recursive: true });
  await fs.promises.cp(outDir, backendBuildDir, { recursive: true });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

