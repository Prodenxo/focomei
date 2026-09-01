$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path $PSScriptRoot -Parent
$DevRoot = Split-Path $RepoRoot -Parent

$pkgJson = @'
{
  "name": "PLACEHOLDER_NAME",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "16.2.6",
    "react": "19.2.6",
    "react-dom": "19.2.6"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "4.2.1",
    "@types/node": "22.19.19",
    "@types/react": "19.2.14",
    "@types/react-dom": "19.2.3",
    "eslint": "9.39.4",
    "eslint-config-next": "16.2.6",
    "tailwindcss": "4.2.1",
    "typescript": "5.9.3"
  }
}
'@

function Export-Landing {
  param(
    [string]$SourceName,
    [string]$TargetName,
    [string]$PackageName,
    [string]$NextConfig
  )

  $src = Join-Path $RepoRoot $SourceName
  $dst = Join-Path $DevRoot $TargetName

  if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
  New-Item -ItemType Directory -Path $dst | Out-Null
  New-Item -ItemType Directory -Path "$dst\app" | Out-Null
  New-Item -ItemType Directory -Path "$dst\public" | Out-Null

  Copy-Item "$src\app\*" "$dst\app\" -Recurse
  Copy-Item "$src\public\*" "$dst\public\" -Recurse
  Copy-Item "$src\postcss.config.mjs" "$dst\"
  Copy-Item "$src\eslint.config.mjs" "$dst\"
  Copy-Item "$src\tsconfig.json" "$dst\"

  $gitignore = @"
node_modules
.next
out
.vercel
.env*
.DS_Store
next-env.d.ts
npm-debug.log*
"@
  Set-Content -Path "$dst\.gitignore" -Value $gitignore -Encoding UTF8

  ($pkgJson -replace 'PLACEHOLDER_NAME', $PackageName) | Set-Content "$dst\package.json" -Encoding UTF8
  Set-Content -Path "$dst\next.config.ts" -Value $NextConfig -Encoding UTF8

  Write-Host ">> npm install em $TargetName"
  Push-Location $dst
  npm install --no-fund --no-audit 2>&1 | Out-Host
  Write-Host ">> npm run build em $TargetName"
  npm run build 2>&1 | Out-Host
  Pop-Location
  Write-Host "OK: $dst"
}

$contadoresNext = @'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/lp", destination: "/", permanent: true }];
  },
};

export default nextConfig;
'@

$workshopNext = @'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
'@

Export-Landing -SourceName "focomei-contadores-codigo-fonte" -TargetName "focomei-contadores-lp" -PackageName "focomei-contadores-lp" -NextConfig $contadoresNext
Export-Landing -SourceName "metodo-mei-lucrativo-codigo-fonte" -TargetName "metodo-mei-lucrativo-lp" -PackageName "metodo-mei-lucrativo-lp" -NextConfig $workshopNext
