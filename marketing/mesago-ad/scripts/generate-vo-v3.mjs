#!/usr/bin/env node
/**
 * MesaGoAdV3 voiceover (Edge TTS zh-CN-YunyangNeural, +8% rate).
 * Usage: node scripts/generate-vo-v3.mjs
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public/audio/v3');
mkdirSync(outDir, { recursive: true });

const VOICE = 'zh-CN-YunyangNeural';
const RATE = '+8%';

const tracks = [
  {
    file: 'v3-01-cost.mp3',
    text: '一百张桌，每桌一台四百欧平板，光买设备就要四万欧，还不包括充电、损坏和更换。',
  },
  {
    file: 'v3-02-offline.mp3',
    text: '系统装在店里，外网断了也能下单、结账、出票，营业不中断。',
  },
  {
    file: 'v3-03-roles.mp3',
    text: '服务员开台、转台、并台和点单；收银员核单收款结账。每步有人有时可追溯。',
  },
  {
    file: 'v3-04-guestnet.mp3',
    text: '顾客用自己的手机网络扫码点餐，不用连餐厅Wi-Fi，打开即用、操作更快。',
  },
  {
    file: 'v3-05-devices.mp3',
    text: '电脑手机都能用。服务员和收银员按权限在手机处理，不用反复跑前台。',
  },
  {
    file: 'v3-06-prices.mp3',
    text: '工作日、周末、节假日和分时段价格提前设好，到点自动切换，不用每天手改。',
  },
  {
    file: 'v3-07-history.mp3',
    text: '每笔订单都有完整历史，开台、点单、转台、结账随时可查，责任清楚、追溯方便。',
  },
  {
    file: 'v3-08-proof.mp3',
    text: '已有大型自助餐厅落地使用，少投入、不断网、流程可追溯。',
  },
  {
    file: 'v3-09-end.mp3',
    text: '开台点单到结账，全角色协同、全流程留痕。欢迎预约演示。',
  },
  {
    file: 'v3-10-agent.mp3',
    text: '同时诚招区域代理，本地部署支持，欢迎联系合作。',
  },
];

for (const { file, text } of tracks) {
  const dest = join(outDir, file);
  console.log(`→ ${file}`);
  const r = spawnSync(
    'python3',
    [
      '-c',
      [
        'import asyncio, edge_tts, sys',
        'async def m():',
        '  await edge_tts.Communicate(sys.argv[1], sys.argv[2], rate=sys.argv[3]).save(sys.argv[4])',
        'asyncio.run(m())',
      ].join('\n'),
      text,
      VOICE,
      RATE,
      dest,
    ],
    { stdio: 'inherit' },
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log('Done.', tracks.length, 'tracks →', outDir);
