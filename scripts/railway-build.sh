#!/usr/bin/env bash
set -euo pipefail

corepack enable
pnpm install --frozen-lockfile
pnpm build
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
