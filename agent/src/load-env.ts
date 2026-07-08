import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

function resolveAgentRoot(): string {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, 'src', 'load-env.ts'))) {
    return cwd;
  }
  if (fs.existsSync(path.join(cwd, 'agent', '.env'))) {
    return path.join(cwd, 'agent');
  }
  if (fs.existsSync(path.join(cwd, '.env'))) {
    return cwd;
  }
  return path.join(cwd, 'agent');
}

const agentRoot = resolveAgentRoot();
const envPath = path.join(agentRoot, '.env');
const examplePath = path.join(agentRoot, '.env.example');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (fs.existsSync(examplePath)) {
  console.warn(
    `[agent] ${envPath} not found — loading ${examplePath}. Copy it to .env for production.`
  );
  dotenv.config({ path: examplePath });
} else {
  console.warn(`[agent] No .env file found in ${agentRoot}`);
}
