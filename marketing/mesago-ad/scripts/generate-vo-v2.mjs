#!/usr/bin/env node
/**
 * Regenerate MesaGoAdV2 voiceover (Edge TTS zh-CN-YunyangNeural).
 * Usage: node scripts/generate-vo-v2.mjs
 * Requires: pip install edge-tts  (edge-tts CLI on PATH)
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public/audio');
mkdirSync(outDir, { recursive: true });

const VOICE = 'zh-CN-YunyangNeural';

/** One line per scene VO — sell FARVOO for large buffet (经济·安全·稳定·便捷). */
const tracks = [
  { file: 'v2-01.mp3', text: '大型自助，平板太贵。一块平板就要四百欧，一百张桌就是四万欧起。' },
  { file: 'v2-02.mp3', text: 'FARVOO 让客人手机扫码点，不用买一整面平板墙，省下来的钱更实在。' },
  { file: 'v2-03.mp3', text: '三语菜单，点一下就能下单，酒水订单直达吧台，不用服务员来回跑。' },
  { file: 'v2-04.mp3', text: '系统装在自己店里，数据在本地，外网断了，店照样营业。' },
  { file: 'v2-05.mp3', text: '服务员开台确认人数，开台后二维码才生效，带走也点不了。' },
  { file: 'v2-06.mp3', text: '工作日、周末、节假日，Buffet 价格一次设好，到点自动切换。' },
  { file: 'v2-06b-phone.mp3', text: '楼面看板、手机都能管，开台到收款，一部手机就能做完。' },
  { file: 'v2-08.mp3', text: '葡萄牙大型中餐自助，已有餐厅稳定使用中。' },
  { file: 'v2-07.mp3', text: '欢迎预约演示，专人帮你开通上线。' },
];

for (const { file, text } of tracks) {
  const dest = join(outDir, file);
  console.log(`→ ${file}`);
  execFileSync(
    process.env.EDGE_TTS || 'python3',
    process.env.EDGE_TTS
      ? ['--voice', VOICE, '--text', text, '--write-media', dest]
      : ['-m', 'edge_tts', '--voice', VOICE, '--text', text, '--write-media', dest],
    { stdio: 'inherit' },
  );
}

console.log('Done.', tracks.length, 'tracks →', outDir);
