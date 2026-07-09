const { Client } = require('ssh2');

function runCmd(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '', errOut = '';
      stream.on('data', d => out += d);
      stream.stderr.on('data', d => errOut += d);
      stream.on('close', () => resolve({ out, errOut }));
    });
  });
}

(async () => {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host: '151.243.217.217', port: 22, username: 'root',
      password: 'T%y8qOSoMb', readyTimeout: 10000
    });
  });

  // Get the actual error
  console.log('=== CURL BODY (error details) ===');
  const t = await runCmd(conn, 'curl -s http://127.0.0.1:3000/bitcoin-to-sberbank 2>/dev/null | head -50');
  console.log(t.out);

  console.log('\n=== JOURNAL LOGS (last 30) ===');
  const l = await runCmd(conn, 'journalctl -u ratescope.service --no-pager -n 30 2>/dev/null');
  console.log(l.out);

  // The standalone build needs:
  // 1. .next/standalone/* (server.js, node_modules)
  // 2. .next/static/* (copied into .next/static/)
  // 3. public/* (copied into public/)

  // Let's check what's missing
  console.log('\n=== CHECK PUBLIC DIR ===');
  const p = await runCmd(conn, 'ls -la /opt/ratescope/current/public/ 2>/dev/null || echo "NO PUBLIC DIR"');
  console.log(p.out);

  console.log('\n=== CHECK .next/static ===');
  const st = await runCmd(conn, 'ls -la /opt/ratescope/current/.next/static/ 2>/dev/null || echo "NO .next/static DIR"');
  console.log(st.out);

  console.log('\n=== CHECK PRISMA ===');
  const pr = await runCmd(conn, 'ls -la /opt/ratescope/current/prisma/ 2>/dev/null || echo "NO PRISMA DIR"');
  console.log(pr.out);

  // Check what old backup has
  console.log('\n=== OLD BACKUP CONTENTS ===');
  const ob = await runCmd(conn, 'ls -la /opt/ratescope/current-old-backup/ 2>/dev/null | head -20');
  console.log(ob.out);

  conn.end();
})();
