import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('========================================================');
console.log(' 🏪 KHỞI ĐỘNG PHỐ ẨM THỰC ĐƯỜNG PHỐ VIỆT NAM (DEV)');
console.log('========================================================\n');

// 1. Khởi động Backend Server
console.log('[*] Đang khởi động Backend Server (Hono) tại http://localhost:8787 ...');
const serverProcess = spawn('node', ['server.js'], {
  cwd: path.join(__dirname, 'server'),
  stdio: 'inherit',
  shell: true
});

// 2. Khởi động Static Web Server (Cổng game + 4 game)
console.log('[*] Đang khởi động Web Portal tại http://localhost:8080 ...');
const portalProcess = spawn('npx', ['serve', '.', '-p', '8080', '-L'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

function cleanup() {
  console.log('\n[*] Đang tắt các tiến trình...');
  serverProcess.kill();
  portalProcess.kill();
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
