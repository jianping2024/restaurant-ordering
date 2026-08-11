import { staticFile } from "remotion";
import { v3Assets } from "./V3Visuals";

/**
 * V3b audio swap:
 * - only replace the tracks we need to润色 (offline wifi fallback / flexible guest net)
 * - keep the rest pointing to existing v3 assets to avoid duplication
 */
export const v3bAssets = {
  ...v3Assets,
  vo2: staticFile("audio/v3b/v3b-02-offline-wifi.mp3"),
  vo4: staticFile("audio/v3b/v3b-04-guestnet-flex.mp3"),
  voProof: staticFile("audio/v3b/v3b-08-proof-classic-sushi.mp3"),
  vo8: staticFile("audio/v3b/v3b-09-end-classic-sushi.mp3"),
};

export type V3bAssets = typeof v3bAssets;

