#!/usr/bin/env node
/**
 * MesaGoAdV3b voiceover (Edge TTS zh-CN-YunyangNeural)
 *
 * Only generate the tracks we changed for v3b:
 * - v3b-02-offline-wifi.mp3
 * - v3b-04-guestnet-flex.mp3
 * - v3b-08-proof-classic-sushi.mp3
 * - v3b-09-end-classic-sushi.mp3
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public/audio/v3b");
mkdirSync(outDir, { recursive: true });

const VOICE = "zh-CN-YunyangNeural";
const RATE = "+8%";

const tracks = [
  {
    file: "v3b-02-offline-wifi.mp3",
    text: "系统本地安装。外网断了连店内 Wi-Fi，继续扫码点餐，结账不中断。",
  },
  {
    file: "v3b-04-guestnet-flex.mp3",
    text: "顾客扫码点餐，4G 或 5G 即开；外网断了也能连店内 Wi-Fi 继续点。",
  },
  {
    file: "v3b-08-proof-classic-sushi.mp3",
    text: "我们是专业的餐厅点餐系统服务商。已有大型自助餐厅在稳定使用，小餐馆同样可以安装。",
  },
  {
    file: "v3b-09-end-classic-sushi.mp3",
    text: "开台到结账全覆盖。经典自助、寿司自助和小餐馆都支持，欢迎预约演示。",
  },
];

for (const { file, text } of tracks) {
  const dest = join(outDir, file);
  console.log(`→ ${file}`);
  const r = spawnSync(
    "python3",
    [
      "-c",
      [
        "import asyncio, edge_tts, sys",
        "async def m():",
        "  await edge_tts.Communicate(sys.argv[1], sys.argv[2], rate=sys.argv[3]).save(sys.argv[4])",
        "asyncio.run(m())",
      ].join("\n"),
      text,
      VOICE,
      RATE,
      dest,
    ],
    { stdio: "inherit" },
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log("Done.", tracks.length, "tracks →", outDir);

