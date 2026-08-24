#!/usr/bin/env node
/**
 * Cursor MCP launcher: forces cwd so tsconfig paths (@/) resolve.
 * Usage: node mcp/run-stdio.mjs
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const stdio = path.join(root, 'mcp', 'stdio.ts')
const envFile = path.join(root, '.env.local')

const child = spawn(
  process.execPath,
  [tsxCli, `--env-file=${envFile}`, stdio],
  {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, STAR_PM_MCP_STDIO: '1' },
  },
)
child.on('exit', (code, signal) => {
  if (signal) process.exit(1)
  process.exit(code ?? 0)
})
