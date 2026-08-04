import React from "react";
import { Composition, Folder } from "remotion";
import { MesaGoAd, MESAGO_AD_DURATION } from "./MesaGoAd";
import { MesaGoAdV2, MESAGO_AD_V2_DURATION } from "./MesaGoAdV2";
import { SceneBusy } from "./scenes/SceneBusy";
import { SceneScan } from "./scenes/SceneScan";
import { SceneBackend } from "./scenes/SceneBackend";
import { SceneKitchen } from "./scenes/SceneKitchen";
import { SceneEnd } from "./scenes/SceneEnd";
import {
  AdProps,
  FPS,
  HEIGHT,
  WIDTH,
  defaultAdProps,
} from "./theme";

const sceneMeta = {
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MesaGoAdV2"
        component={MesaGoAdV2}
        durationInFrames={MESAGO_AD_V2_DURATION}
        {...sceneMeta}
        defaultProps={defaultAdProps satisfies AdProps}
      />
      <Composition
        id="MesaGoAd"
        component={MesaGoAd}
        durationInFrames={MESAGO_AD_DURATION}
        {...sceneMeta}
        defaultProps={defaultAdProps satisfies AdProps}
      />

      <Folder name="Scenes-v1">
        <Composition
          id="SceneBusy"
          component={SceneBusy}
          durationInFrames={5 * FPS}
          {...sceneMeta}
        />
        <Composition
          id="SceneScan"
          component={SceneScan}
          durationInFrames={5 * FPS}
          {...sceneMeta}
        />
        <Composition
          id="SceneBackend"
          component={SceneBackend}
          durationInFrames={8 * FPS}
          {...sceneMeta}
        />
        <Composition
          id="SceneKitchen"
          component={SceneKitchen}
          durationInFrames={7 * FPS}
          {...sceneMeta}
        />
        <Composition
          id="SceneEnd"
          component={SceneEnd}
          durationInFrames={5 * FPS}
          {...sceneMeta}
          defaultProps={defaultAdProps}
        />
      </Folder>
    </>
  );
};
