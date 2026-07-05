@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

echo.
echo ==========================================
echo  RateScope setup, GitHub push and Vercel deploy
echo ==========================================
echo.

set "PATH=%PATH%;%ProgramFiles%\Git\cmd;%ProgramFiles%\nodejs;%ProgramFiles%\GitHub CLI;%LocalAppData%\Programs\Git\cmd;%LocalAppData%\Programs\nodejs"

where git >nul 2>nul
if errorlevel 1 goto install_tools
where node >nul 2>nul
if errorlevel 1 goto install_tools
where npm >nul 2>nul
if errorlevel 1 goto install_tools
where gh >nul 2>nul
if errorlevel 1 goto install_tools
goto after_tool_install

:install_tools
where winget >nul 2>nul
if errorlevel 1 (
  echo winget was not found. Falling back to direct downloads.
  echo Installer windows may ask for administrator permission.
  echo.

  set "DOWNLOAD_DIR=%TEMP%\ratescope-setup"
  if not exist "!DOWNLOAD_DIR!" mkdir "!DOWNLOAD_DIR!"

  echo Downloading Git installer...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $release=Invoke-RestMethod 'https://api.github.com/repos/git-for-windows/git/releases/latest'; $asset=$release.assets | Where-Object { $_.name -match '64-bit\.exe$' -and $_.name -notmatch 'Portable|MinGit|busybox' } | Select-Object -First 1; if (-not $asset) { throw 'Git installer not found' }; Invoke-WebRequest $asset.browser_download_url -OutFile '%TEMP%\ratescope-setup\git-installer.exe'"
  if errorlevel 1 (
    echo Could not download Git installer.
    pause
    exit /b 1
  )
  start /wait "" "%TEMP%\ratescope-setup\git-installer.exe" /VERYSILENT /NORESTART

  echo.
  echo Downloading Node.js LTS installer...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $index=Invoke-RestMethod 'https://nodejs.org/dist/index.json'; $version=($index | Where-Object { $_.lts -ne $false -and $_.files -contains 'win-x64-msi' } | Select-Object -First 1).version; if (-not $version) { throw 'Node LTS installer not found' }; Invoke-WebRequest ('https://nodejs.org/dist/' + $version + '/node-' + $version + '-x64.msi') -OutFile '%TEMP%\ratescope-setup\node-lts-x64.msi'"
  if errorlevel 1 (
    echo Could not download Node.js installer.
    pause
    exit /b 1
  )
  msiexec /i "%TEMP%\ratescope-setup\node-lts-x64.msi" /qn /norestart

  echo.
  echo Downloading GitHub CLI installer...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $release=Invoke-RestMethod 'https://api.github.com/repos/cli/cli/releases/latest'; $asset=$release.assets | Where-Object { $_.name -match 'windows_amd64\.msi$' } | Select-Object -First 1; if (-not $asset) { throw 'GitHub CLI installer not found' }; Invoke-WebRequest $asset.browser_download_url -OutFile '%TEMP%\ratescope-setup\gh-cli.msi'"
  if errorlevel 1 (
    echo Could not download GitHub CLI installer.
    pause
    exit /b 1
  )
  msiexec /i "%TEMP%\ratescope-setup\gh-cli.msi" /qn /norestart
) else (
  echo Installing Git...
  winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements

  echo.
  echo Installing Node.js LTS...
  winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements

  echo.
  echo Installing GitHub CLI...
  winget install --id GitHub.cli -e --source winget --accept-package-agreements --accept-source-agreements
)

:after_tool_install
echo.
echo Refreshing PATH for this window...
set "PATH=%PATH%;%ProgramFiles%\Git\cmd;%ProgramFiles%\nodejs;%ProgramFiles%\GitHub CLI;%LocalAppData%\Programs\Git\cmd;%LocalAppData%\Programs\nodejs"

set "NEED_PORTABLE_TOOLS=0"
where git >nul 2>nul
if errorlevel 1 (
  set "NEED_PORTABLE_TOOLS=1"
)
where node >nul 2>nul
if errorlevel 1 (
  set "NEED_PORTABLE_TOOLS=1"
)
where npm >nul 2>nul
if errorlevel 1 (
  set "NEED_PORTABLE_TOOLS=1"
)
where gh >nul 2>nul
if errorlevel 1 (
  set "NEED_PORTABLE_TOOLS=1"
)

if "%NEED_PORTABLE_TOOLS%"=="1" (
  echo.
  echo System tools are not available. Downloading portable tools into this project...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $root=(Resolve-Path '.').Path; $tools=Join-Path $root '.tools'; New-Item -ItemType Directory -Force $tools | Out-Null; $tmp=Join-Path $env:TEMP 'ratescope-portable'; New-Item -ItemType Directory -Force $tmp | Out-Null; function Download($url,$out){ Invoke-WebRequest $url -OutFile $out }; if (-not (Test-Path (Join-Path $tools 'git\cmd\git.exe'))) { $rel=Invoke-RestMethod 'https://api.github.com/repos/git-for-windows/git/releases/latest'; $asset=$rel.assets | Where-Object { $_.name -match 'MinGit.*64-bit\.zip$' -and $_.name -notmatch 'busybox' } | Select-Object -First 1; if (-not $asset) { throw 'Portable Git not found' }; $zip=Join-Path $tmp 'mingit.zip'; Download $asset.browser_download_url $zip; Remove-Item (Join-Path $tools 'git') -Recurse -Force -ErrorAction SilentlyContinue; New-Item -ItemType Directory -Force (Join-Path $tools 'git') | Out-Null; Expand-Archive $zip (Join-Path $tools 'git') -Force }; if (-not (Get-ChildItem (Join-Path $tools 'node') -Filter node.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1)) { $index=Invoke-RestMethod 'https://nodejs.org/dist/index.json'; $version=($index | Where-Object { $_.lts -ne $false -and $_.files -contains 'win-x64-zip' } | Select-Object -First 1).version; if (-not $version) { throw 'Portable Node not found' }; $zip=Join-Path $tmp 'node.zip'; Download ('https://nodejs.org/dist/' + $version + '/node-' + $version + '-win-x64.zip') $zip; Remove-Item (Join-Path $tools 'node') -Recurse -Force -ErrorAction SilentlyContinue; New-Item -ItemType Directory -Force (Join-Path $tools 'node') | Out-Null; Expand-Archive $zip (Join-Path $tools 'node') -Force }; if (-not (Get-ChildItem (Join-Path $tools 'gh') -Filter gh.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1)) { $rel=Invoke-RestMethod 'https://api.github.com/repos/cli/cli/releases/latest'; $asset=$rel.assets | Where-Object { $_.name -match 'windows_amd64\.zip$' } | Select-Object -First 1; if (-not $asset) { throw 'Portable GitHub CLI not found' }; $zip=Join-Path $tmp 'gh.zip'; Download $asset.browser_download_url $zip; Remove-Item (Join-Path $tools 'gh') -Recurse -Force -ErrorAction SilentlyContinue; New-Item -ItemType Directory -Force (Join-Path $tools 'gh') | Out-Null; Expand-Archive $zip (Join-Path $tools 'gh') -Force }"
  if errorlevel 1 (
    echo Portable tools download failed.
    pause
    exit /b 1
  )
)

set "PATH=%CD%\.tools\git\cmd;%PATH%"
for /d %%D in ("%CD%\.tools\node\node-*-win-x64") do set "PATH=%%~fD;%%~fD\node_modules\npm\bin;%PATH%"
for /d %%D in ("%CD%\.tools\gh\gh_*_windows_amd64") do set "PATH=%%~fD\bin;%PATH%"

where git >nul 2>nul
if errorlevel 1 (
  echo Git is still not available.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is still not available.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm is still not available.
  pause
  exit /b 1
)

where gh >nul 2>nul
if errorlevel 1 (
  echo GitHub CLI is still not available.
  pause
  exit /b 1
)

echo.
echo Installing project dependencies...
call npm install
if errorlevel 1 (
  echo npm install failed.
  pause
  exit /b 1
)

echo.
echo Installing Vercel CLI...
call npm install vercel --save-dev
if errorlevel 1 (
  echo Vercel CLI install failed.
  pause
  exit /b 1
)

echo.
echo Checking local build...
call npm run build
if errorlevel 1 (
  echo Build failed. Fix the errors above, then run this file again.
  pause
  exit /b 1
)

echo.
echo Logging in to GitHub. A browser window or code prompt may open.
call gh auth status >nul 2>nul
if errorlevel 1 (
  call gh auth login
  if errorlevel 1 (
    echo GitHub login failed.
    pause
    exit /b 1
  )
)

if not exist ".git\HEAD" (
  echo.
  echo Initializing or repairing Git repository...
  if exist ".git" ren ".git" ".git-broken-%RANDOM%"
  git -C "%CD%" init
)

if not exist ".git\HEAD" (
  echo Git repository could not be initialized.
  pause
  exit /b 1
)

git -C "%CD%" config user.name >nul 2>nul
if errorlevel 1 git -C "%CD%" config user.name "RateScope Publisher"

git -C "%CD%" config user.email >nul 2>nul
if errorlevel 1 git -C "%CD%" config user.email "boecguseynov@gmail.com"

echo.
echo Preparing commit...
git -C "%CD%" add .
git -C "%CD%" diff --cached --quiet
if errorlevel 1 (
  git -C "%CD%" commit -m "Initial RateScope site"
) else (
  echo Nothing new to commit.
)

git -C "%CD%" branch -M main

echo.
echo Creating GitHub repository and pushing...
gh repo view boecguseynov-ship-it/exchange-monitoring-mvp-public >nul 2>nul
if errorlevel 1 (
  gh repo create boecguseynov-ship-it/exchange-monitoring-mvp-public --public
)

if errorlevel 1 (
  echo GitHub repository creation failed.
  pause
  exit /b 1
)

git -C "%CD%" remote remove origin >nul 2>nul
git -C "%CD%" remote add origin https://github.com/boecguseynov-ship-it/exchange-monitoring-mvp-public.git
git -C "%CD%" push -u origin main

if errorlevel 1 (
  echo GitHub push failed.
  pause
  exit /b 1
)

echo.
echo Logging in to Vercel. A browser window or code prompt may open.
call npx vercel whoami >nul 2>nul
if errorlevel 1 (
  call npx vercel login
  if errorlevel 1 (
    echo Vercel login failed.
    pause
    exit /b 1
  )
)

echo.
echo Deploying to Vercel production...
call npx vercel --prod --yes
if errorlevel 1 (
  echo Vercel deploy failed.
  pause
  exit /b 1
)

echo.
echo Done.
echo GitHub: https://github.com/boecguseynov-ship-it/exchange-monitoring-mvp-public
echo The Vercel production URL is shown above.
pause
