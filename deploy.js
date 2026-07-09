const { Client } = require('ssh2');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const CONFIG = {
  host: '151.243.217.217',
  user: 'root',
  password: 'T%y8qOSoMb',
  appName: 'ratescope',
  serviceName: 'ratescope.service',
  port: 3000,
  appRoot: '/opt/ratescope',
  buildsDir: '/opt/ratescope/builds',
  dataDir: '/opt/ratescope/data',
  databaseUrl: 'file:/opt/ratescope/data/ratescope.db',
  releasesDir: '/opt/ratescope/releases',
  requiredPrismaVersion: '6.19.3'
};

const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const rootDir = __dirname;
const sourceStageDir = path.join(rootDir, '.deploy-source');
const sourceTarPath = path.join(rootDir, 'ratescope-source.tar.gz');
const remoteTarPath = `/tmp/${CONFIG.appName}-source-${timestamp}.tar.gz`;
const remoteBuildDir = `${CONFIG.buildsDir}/${timestamp}`;
const releaseDir = `${CONFIG.releasesDir}/${timestamp}`;
const args = new Set(process.argv.slice(2));

function log(message = '') {
  console.log(message);
}

function runLocal(command, commandArgs, options = {}) {
  execFileSync(command, commandArgs, {
    cwd: rootDir,
    stdio: 'inherit',
    ...options
  });
}

function runLocalText(command, commandArgs) {
  try {
    return execFileSync(command, commandArgs, {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return null;
  }
}

function copyDir(from, to, optional = false) {
  if (!fs.existsSync(from)) {
    if (optional) return;
    throw new Error(`Required deploy folder is missing: ${from}`);
  }
  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

function copyFile(from, to, optional = false) {
  if (!fs.existsSync(from)) {
    if (optional) return;
    throw new Error(`Required deploy file is missing: ${from}`);
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function packageJson() {
  return JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
}

function verifyPinnedPrisma() {
  const pkg = packageJson();
  const clientVersion = pkg.dependencies?.['@prisma/client'];
  const cliVersion = pkg.devDependencies?.prisma || pkg.dependencies?.prisma;

  if (clientVersion !== CONFIG.requiredPrismaVersion || cliVersion !== CONFIG.requiredPrismaVersion) {
    throw new Error(
      `Prisma must be pinned to ${CONFIG.requiredPrismaVersion}. Found prisma=${cliVersion}, @prisma/client=${clientVersion}`
    );
  }
}

function writeDeployInfo() {
  const info = {
    app: CONFIG.appName,
    release: timestamp,
    preparedAt: new Date().toISOString(),
    gitCommit: runLocalText('git', ['rev-parse', '--short', 'HEAD']),
    gitBranch: runLocalText('git', ['branch', '--show-current']),
    prisma: CONFIG.requiredPrismaVersion,
    serverOs: 'Ubuntu 22.04',
    build: 'server-side'
  };

  fs.writeFileSync(
    path.join(sourceStageDir, '.deploy-info.json'),
    JSON.stringify(info, null, 2)
  );
}

function prepareSourceArchive() {
  verifyPinnedPrisma();

  log('Preparing source package for server-side Ubuntu build...');
  fs.rmSync(sourceStageDir, { recursive: true, force: true });
  fs.rmSync(sourceTarPath, { force: true });
  fs.mkdirSync(sourceStageDir, { recursive: true });

  copyDir(path.join(rootDir, 'src'), path.join(sourceStageDir, 'src'));
  copyDir(path.join(rootDir, 'public'), path.join(sourceStageDir, 'public'));
  copyDir(path.join(rootDir, 'scripts'), path.join(sourceStageDir, 'scripts'), true);
  fs.mkdirSync(path.join(sourceStageDir, 'prisma'), { recursive: true });
  copyFile(path.join(rootDir, 'prisma', 'schema.prisma'), path.join(sourceStageDir, 'prisma', 'schema.prisma'));

  copyFile(path.join(rootDir, 'package.json'), path.join(sourceStageDir, 'package.json'));
  copyFile(path.join(rootDir, 'package-lock.json'), path.join(sourceStageDir, 'package-lock.json'));
  copyFile(path.join(rootDir, 'next.config.ts'), path.join(sourceStageDir, 'next.config.ts'));
  copyFile(path.join(rootDir, 'tsconfig.json'), path.join(sourceStageDir, 'tsconfig.json'));
  copyFile(path.join(rootDir, 'next-env.d.ts'), path.join(sourceStageDir, 'next-env.d.ts'), true);
  copyFile(path.join(rootDir, 'eslint.config.mjs'), path.join(sourceStageDir, 'eslint.config.mjs'), true);
  copyFile(path.join(rootDir, '.env'), path.join(sourceStageDir, '.env'), true);
  copyFile(path.join(rootDir, '.env.example'), path.join(sourceStageDir, '.env.example'), true);

  writeDeployInfo();

  runLocal('tar', ['-czf', sourceTarPath, '-C', sourceStageDir, '.']);
  log(`Source package ready: ${path.basename(sourceTarPath)} (${(fs.statSync(sourceTarPath).size / 1024 / 1024).toFixed(1)} MB)`);
}

function connectSsh() {
  const conn = new Client();
  return new Promise((resolve, reject) => {
    conn
      .on('ready', () => resolve(conn))
      .on('error', reject)
      .connect({
        host: CONFIG.host,
        port: 22,
        username: CONFIG.user,
        password: CONFIG.password,
        readyTimeout: 15000
      });
  });
}

function runRemote(conn, command, label) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);

      let out = '';
      let errOut = '';
      stream.on('data', (data) => out += data);
      stream.stderr.on('data', (data) => errOut += data);
      stream.on('close', (code) => {
        if (code !== 0) {
          const error = new Error(`${label || 'Remote command'} failed with code ${code}`);
          error.out = out;
          error.errOut = errOut;
          reject(error);
          return;
        }
        resolve({ out, errOut });
      });
    });
  });
}

function uploadFile(conn, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);

      const total = fs.statSync(localPath).size;
      let transferred = 0;
      log(`Uploading ${path.basename(localPath)} (${(total / 1024 / 1024).toFixed(1)} MB)...`);

      const readStream = fs.createReadStream(localPath);
      const writeStream = sftp.createWriteStream(remotePath);

      readStream.on('data', (chunk) => {
        transferred += chunk.length;
        process.stdout.write(`\rUpload progress: ${((transferred / total) * 100).toFixed(1)}%`);
      });
      readStream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('close', () => {
        process.stdout.write('\n');
        sftp.end();
        resolve();
      });

      readStream.pipe(writeStream);
    });
  });
}

function serviceFileScript() {
  return `rm -f /etc/systemd/system/${CONFIG.serviceName}.d/env.conf
rmdir --ignore-fail-on-non-empty /etc/systemd/system/${CONFIG.serviceName}.d 2>/dev/null || true
cat > /etc/systemd/system/${CONFIG.serviceName} <<'EOF'
[Unit]
Description=monik exchange Next.js app
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${CONFIG.appRoot}/current
EnvironmentFile=-${CONFIG.appRoot}/current/.env
Environment=NODE_ENV=production
Environment=PORT=${CONFIG.port}
Environment=HOSTNAME=0.0.0.0
ExecStart=/usr/bin/env node server.js
Restart=always
RestartSec=3
KillMode=mixed
TimeoutStopSec=10

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable ${CONFIG.serviceName} >/dev/null`;
}

async function buildOnServer(conn) {
  log('Building on Ubuntu 22.04 server...');
  const result = await runRemote(conn, `
set -euo pipefail
mkdir -p ${CONFIG.buildsDir} ${CONFIG.releasesDir} ${CONFIG.dataDir}
rm -rf ${remoteBuildDir} ${releaseDir}
mkdir -p ${remoteBuildDir} ${releaseDir}
tar -xzf ${remoteTarPath} -C ${remoteBuildDir}
rm -f ${remoteTarPath}
cd ${remoteBuildDir}
if grep -q '^DATABASE_URL=' .env 2>/dev/null; then
  sed -i 's#^DATABASE_URL=.*#DATABASE_URL="${CONFIG.databaseUrl}"#' .env
else
  printf '\\nDATABASE_URL="${CONFIG.databaseUrl}"\\n' >> .env
fi
node -v
npm -v
npm ci
node -e "const pv=require('./node_modules/prisma/package.json').version; const cv=require('./node_modules/@prisma/client/package.json').version; if (pv !== '${CONFIG.requiredPrismaVersion}' || cv !== '${CONFIG.requiredPrismaVersion}') { console.error('Expected Prisma ${CONFIG.requiredPrismaVersion}, got prisma=' + pv + ', @prisma/client=' + cv); process.exit(1); } console.log('Using local Prisma CLI ' + pv);"
./node_modules/.bin/prisma generate --schema=prisma/schema.prisma
./node_modules/.bin/prisma db push --schema=prisma/schema.prisma --skip-generate
npm run build
cp -a .next/standalone/. ${releaseDir}/
mkdir -p ${releaseDir}/.next
cp -a .next/static ${releaseDir}/.next/static
cp -a public ${releaseDir}/public
if [ -d scripts ]; then cp -a scripts ${releaseDir}/scripts; fi
cp -a prisma ${releaseDir}/prisma
cp -a package.json package-lock.json .deploy-info.json ${releaseDir}/
if [ -f .env ]; then cp -a .env ${releaseDir}/.env; fi
cd ${releaseDir}
node -e "const fs=require('fs'); const files=fs.readdirSync('node_modules/.prisma/client'); const engines=files.filter(f=>f.includes('query_engine')); console.log('Runtime Prisma engines: ' + engines.join(', ')); if (!engines.length) { console.error('No Prisma query engine in runtime'); process.exit(1); } if (engines.some(f=>f.includes('windows'))) { console.error('Windows Prisma engine is still present'); process.exit(1); }"
test -f server.js
test -d .next/static
cat .deploy-info.json
`, 'Server build');

  process.stdout.write(result.out);
  if (result.errOut) process.stderr.write(result.errOut);
}

async function switchRelease(conn) {
  log('Switching the service to the new release...');
  const result = await runRemote(conn, `
set -euo pipefail
${serviceFileScript()}
OLD_RELEASE="$(readlink -f ${CONFIG.appRoot}/current 2>/dev/null || true)"
systemctl stop ${CONFIG.serviceName} || true
if command -v fuser >/dev/null 2>&1; then
  fuser -k ${CONFIG.port}/tcp >/dev/null 2>&1 || true
fi
ln -sfn ${releaseDir} ${CONFIG.appRoot}/current-next
mv -Tf ${CONFIG.appRoot}/current-next ${CONFIG.appRoot}/current
systemctl reset-failed ${CONFIG.serviceName} || true
systemctl start ${CONFIG.serviceName}
sleep 4
if ! systemctl is-active --quiet ${CONFIG.serviceName}; then
  echo "New release failed to start; rolling back to $OLD_RELEASE" >&2
  if [ -n "$OLD_RELEASE" ] && [ -d "$OLD_RELEASE" ]; then
    ln -sfn "$OLD_RELEASE" ${CONFIG.appRoot}/current
    systemctl start ${CONFIG.serviceName} || true
  fi
  systemctl status ${CONFIG.serviceName} --no-pager >&2 || true
  exit 1
fi
echo "Current release: $(readlink -f ${CONFIG.appRoot}/current)"
echo "Listening on port ${CONFIG.port}:"
ss -ltnp "sport = :${CONFIG.port}" || true
`, 'Switch release');

  process.stdout.write(result.out);
  if (result.errOut) process.stderr.write(result.errOut);
}

async function verifyRelease(conn) {
  log('Checking deployed pages...');
  const result = await runRemote(conn, `
set -euo pipefail
cat ${CONFIG.appRoot}/current/.deploy-info.json
for url in / /bitcoin-to-sberbank /exchange/BTC/SBERRUB /usdt-trc20-to-sberbank /ru/exchange/BTC/SBERRUB; do
  code="$(curl -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1:${CONFIG.port}$url")"
  echo "local $url -> HTTP $code"
  case "$code" in
    2*|3*) ;;
    *) exit 1 ;;
  esac
done
external="$(curl -k -sS -o /dev/null -w "%{http_code}" "https://monik.exchange/bitcoin-to-sberbank" || true)"
echo "external https://monik.exchange/bitcoin-to-sberbank -> HTTP $external"
`, 'Verify release');

  process.stdout.write(result.out);
  if (result.errOut) process.stderr.write(result.errOut);
}

async function cleanupServer(conn) {
  await runRemote(conn, `
set -euo pipefail
cd ${CONFIG.releasesDir}
ls -1t | tail -n +6 | xargs -r rm -rf
cd ${CONFIG.buildsDir}
ls -1t | tail -n +4 | xargs -r rm -rf
rm -f /tmp/${CONFIG.appName}-source-*.tar.gz
`, 'Cleanup');
}

(async () => {
  prepareSourceArchive();
  if (args.has('--package-only')) {
    log('Package-only mode finished.');
    return;
  }

  const conn = await connectSsh();
  try {
    log('Connected to the server.');
    await uploadFile(conn, sourceTarPath, remoteTarPath);
    await buildOnServer(conn);
    await switchRelease(conn);
    await verifyRelease(conn);
    await cleanupServer(conn);
    log('Deploy complete.');
  } finally {
    conn.end();
  }
})().catch((error) => {
  console.error(error.message);
  if (error.out) console.error(error.out);
  if (error.errOut) console.error(error.errOut);
  process.exit(1);
});
