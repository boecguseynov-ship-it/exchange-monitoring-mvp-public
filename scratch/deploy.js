const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();

const CONFIG = {
  host: '151.243.217.217',
  port: 22,
  username: 'root',
  password: 'T%y8qOSoMb',
  localTar: path.join(__dirname, 'ratescope.tar.gz'),
  remoteTar: '/tmp/ratescope.tar.gz',
  remotePath: '/var/www/ratescope'
};

conn.on('ready', () => {
  console.log('SSH connection established.');
  
  // Step 1: Upload Tar File
  console.log('Uploading tar archive...');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    
    sftp.fastPut(CONFIG.localTar, CONFIG.remoteTar, (uploadErr) => {
      if (uploadErr) {
        console.error('SFTP upload error:', uploadErr);
        conn.end();
        return;
      }
      console.log('Tar archive uploaded successfully to /tmp/ratescope.tar.gz');
      
      // Step 2: Run SSH Commands for extraction, setup, build, and run
      runRemoteSetup();
    });
  });
}).on('error', (err) => {
  console.error('SSH connection error:', err);
}).connect({
  host: CONFIG.host,
  port: CONFIG.port,
  username: CONFIG.username,
  password: CONFIG.password
});

function runRemoteSetup() {
  const commands = [
    `mkdir -p ${CONFIG.remotePath}`,
    `tar -xzf ${CONFIG.remoteTar} -C ${CONFIG.remotePath}`,
    `rm -f ${CONFIG.remoteTar}`,
    `cd ${CONFIG.remotePath} && npm install --production=false`,
    `cd ${CONFIG.remotePath} && npx prisma db push`,
    `cd ${CONFIG.remotePath} && npm run build`,
    `npm install -g pm2`,
    `pm2 delete ratescope || true`,
    `cd ${CONFIG.remotePath} && pm2 start npm --name "ratescope" -- run start`,
    `pm2 save`,
    // Write Nginx config
    `cat << 'EOF' > /etc/nginx/sites-available/ratescope
server {
    listen 80;
    server_name 151.243.217.217;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF`,
    `ln -sf /etc/nginx/sites-available/ratescope /etc/nginx/sites-enabled/ratescope`,
    `rm -f /etc/nginx/sites-enabled/default`,
    `nginx -t`,
    `systemctl reload nginx`
  ];

  let currentCommandIndex = 0;

  function runNext() {
    if (currentCommandIndex >= commands.length) {
      console.log('\n========================================');
      console.log('Deployment completed successfully!');
      console.log('========================================');
      conn.end();
      return;
    }

    const cmd = commands[currentCommandIndex++];
    console.log(`\n========================================`);
    console.log(`Executing: ${cmd}`);
    console.log(`========================================`);

    conn.exec(cmd, (err, stream) => {
      if (err) {
        console.error(`Error executing command: ${err.message}`);
        conn.end();
        return;
      }
      stream.on('close', (code, signal) => {
        if (code !== 0 && !cmd.includes('pm2 delete')) {
          console.error(`Command failed with code ${code}. Terminating deployment.`);
          conn.end();
          return;
        }
        runNext();
      }).on('data', (data) => {
        process.stdout.write(data);
      }).stderr.on('data', (data) => {
        process.stderr.write(data);
      });
    });
  }

  runNext();
}
