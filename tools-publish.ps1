$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$tools = Join-Path $root ".tools"
$tmp = Join-Path $env:TEMP "ratescope-portable"
New-Item -ItemType Directory -Force $tools | Out-Null
New-Item -ItemType Directory -Force $tmp | Out-Null
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Download-File($url, $out) {
  Invoke-WebRequest $url -OutFile $out
}

function Ensure-Git {
  $git = Join-Path $tools "git\cmd\git.exe"
  if (Test-Path $git) { return $git }

  $release = Invoke-RestMethod "https://api.github.com/repos/git-for-windows/git/releases/latest"
  $asset = $release.assets |
    Where-Object { $_.name -match "MinGit.*64-bit\.zip$" -and $_.name -notmatch "busybox" } |
    Select-Object -First 1
  if (-not $asset) { throw "Portable Git archive not found" }

  $zip = Join-Path $tmp "mingit.zip"
  Download-File $asset.browser_download_url $zip
  Remove-Item (Join-Path $tools "git") -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force (Join-Path $tools "git") | Out-Null
  Expand-Archive $zip (Join-Path $tools "git") -Force
  return $git
}

function Ensure-Node {
  $existing = Get-ChildItem (Join-Path $tools "node") -Filter node.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($existing) { return $existing.DirectoryName }

  $zip = Join-Path $tmp "node.zip"
  if (-not (Test-Path $zip)) {
    $index = Invoke-RestMethod "https://nodejs.org/dist/index.json"
    $version = ($index | Where-Object { $_.lts -ne $false -and $_.files -contains "win-x64-zip" } | Select-Object -First 1).version
    if (-not $version) { throw "Portable Node archive not found" }
    Download-File "https://nodejs.org/dist/$version/node-$version-win-x64.zip" $zip
  }

  Remove-Item (Join-Path $tools "node") -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force (Join-Path $tools "node") | Out-Null
  Expand-Archive $zip (Join-Path $tools "node") -Force
  $node = Get-ChildItem (Join-Path $tools "node") -Filter node.exe -Recurse | Select-Object -First 1
  if (-not $node) { throw "node.exe was not found after extraction" }
  return $node.DirectoryName
}

function Ensure-Gh {
  $existing = Get-ChildItem (Join-Path $tools "gh") -Filter gh.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($existing) { return $existing.FullName }

  $release = Invoke-RestMethod "https://api.github.com/repos/cli/cli/releases/latest"
  $asset = $release.assets |
    Where-Object { $_.name -match "windows_amd64\.zip$" } |
    Select-Object -First 1
  if (-not $asset) { throw "Portable GitHub CLI archive not found" }

  $zip = Join-Path $tmp "gh.zip"
  Download-File $asset.browser_download_url $zip
  Remove-Item (Join-Path $tools "gh") -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force (Join-Path $tools "gh") | Out-Null
  Expand-Archive $zip (Join-Path $tools "gh") -Force
  $gh = Get-ChildItem (Join-Path $tools "gh") -Filter gh.exe -Recurse | Select-Object -First 1
  if (-not $gh) { throw "gh.exe was not found after extraction" }
  return $gh.FullName
}

$git = Ensure-Git
$nodeDir = Ensure-Node
$gh = Ensure-Gh
$env:Path = "$nodeDir;$nodeDir\node_modules\npm\bin;$(Split-Path -Parent $git);$(Split-Path -Parent $gh);$env:Path"

Write-Host "Using Git: $git"
Write-Host "Using Node: $nodeDir"
Write-Host "Using GitHub CLI: $gh"

& $git config --global --add safe.directory $root

& npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

& npm run build
if ($LASTEXITCODE -ne 0) { throw "build failed" }

& $gh auth status
if ($LASTEXITCODE -ne 0) {
  & $gh auth login
  if ($LASTEXITCODE -ne 0) { throw "GitHub login failed" }
}

if (-not (Test-Path ".git\HEAD")) {
  & $git init
  if ($LASTEXITCODE -ne 0) { throw "git init failed" }
}

& $git config user.name
if ($LASTEXITCODE -ne 0) { & $git config user.name "RateScope Publisher" }
& $git config user.email
if ($LASTEXITCODE -ne 0) { & $git config user.email "boecguseynov@gmail.com" }

& $git add .
if ($LASTEXITCODE -ne 0) { throw "git add failed" }
& $git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  & $git commit -m "Publish RateScope site"
  if ($LASTEXITCODE -ne 0) { throw "git commit failed" }
}

& $git branch -M main
if ($LASTEXITCODE -ne 0) { throw "git branch failed" }

& $gh repo view boecguseynov-ship-it/exchange-monitoring-mvp-public
if ($LASTEXITCODE -ne 0) {
  & $gh repo create boecguseynov-ship-it/exchange-monitoring-mvp-public --public
  if ($LASTEXITCODE -ne 0) { throw "GitHub repo creation failed" }
}

$remotes = & $git remote
if ($remotes -contains "origin") {
  & $git remote remove origin
  if ($LASTEXITCODE -ne 0) { throw "git remote remove failed" }
}
& $git remote add origin "https://github.com/boecguseynov-ship-it/exchange-monitoring-mvp-public.git"
& $git push -u origin main
if ($LASTEXITCODE -ne 0) { throw "git push failed" }

& npm install vercel --save-dev
if ($LASTEXITCODE -ne 0) { throw "Vercel CLI install failed" }

& npx vercel whoami
if ($LASTEXITCODE -ne 0) {
  & npx vercel login
  if ($LASTEXITCODE -ne 0) { throw "Vercel login failed" }
}

& npx vercel --prod --yes
if ($LASTEXITCODE -ne 0) { throw "Vercel deploy failed" }

Write-Host "DONE"
Write-Host "GitHub: https://github.com/boecguseynov-ship-it/exchange-monitoring-mvp-public"
