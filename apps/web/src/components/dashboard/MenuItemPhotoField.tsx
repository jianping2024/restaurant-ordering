'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ProFeatureBadge } from '@/components/dashboard/ProFeatureBadge';
import type { getMessages } from '@/lib/i18n/messages';
import { mesaSelectionChipShellClass, mesaSelectionChipSoftClass } from '@/lib/mesa-selection-chip';
import {
  DEFAULT_DISH_VIDEO_EFFECT,
  DISH_VIDEO_EFFECT_MESSAGE_KEYS,
  DISH_VIDEO_EFFECTS,
  isDishVideoEffect,
  type DishVideoEffect,
} from '@/lib/menu-dish-video';
import { dishVideoEncodingSupported, encodeDishVideos } from '@/lib/menu-dish-video-encode';
import {
  compressMenuImageForUpload,
  MENU_IMAGE_ACCEPT,
  MENU_IMAGE_ASPECT_CLASS,
  MENU_IMAGE_OBJECT_FIT_CLASS,
  MENU_IMAGE_WELL_BG_CLASS,
  resolveMenuImageDisplayUrl,
  validateMenuImageFile,
} from '@/lib/menu-image';
import {
  enhanceMenuImageFile,
  measureMenuImageQuality,
  menuImageNeedsEnhance,
  type MenuImageQuality,
} from '@/lib/menu-image-quality';
import type { MenuItem } from '@/types';

type MenuManagerMessages = ReturnType<typeof getMessages>['menuManager'];

/** What the dish form sends to `setMenuItemImageClient` on save. */
export type MenuItemPhotoDraft = {
  file: File | null;
  stripImage: boolean;
  video: { detail: Blob; rail: Blob; effect: DishVideoEffect } | null;
  stripVideo: boolean;
  /** Video still encoding — save must wait. */
  busy: boolean;
};

export const EMPTY_MENU_ITEM_PHOTO_DRAFT: MenuItemPhotoDraft = {
  file: null,
  stripImage: false,
  video: null,
  stripVideo: false,
  busy: false,
};

type EffectChoice = DishVideoEffect | 'none';

type PickedPhoto = {
  original: File;
  enhanced: File | null;
  quality: MenuImageQuality;
  useEnhanced: boolean;
};

type Generated = { detail: Blob; rail: Blob; effect: DishVideoEffect; previewUrl: string };

const kb = (n: number) => `${Math.round(n / 1024)}KB`;

/**
 * Sole dish-form photo section: pick / remove photo, free quality check + sharpen choice,
 * and (Pro + `dashboard.menu.video.manage`) motion-effect pick with in-browser encode preview.
 * Mount with a fresh `key` per modal open; reports the save payload via `onDraftChange`.
 */
export function MenuItemPhotoField({
  t,
  proBadgeLabel,
  existing,
  canManageDishVideo,
  dishVideoPro,
  imageError,
  onImageError,
  onDraftChange,
}: {
  t: MenuManagerMessages;
  /** `premiumUpgrade.proBadge`. */
  proBadgeLabel: string;
  existing: Pick<MenuItem, 'image_url' | 'video_url' | 'video_effect'> | null;
  canManageDishVideo: boolean;
  dishVideoPro: boolean;
  imageError: string | null;
  onImageError: (message: string) => void;
  onDraftChange: (draft: MenuItemPhotoDraft) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const existingImageUrl = resolveMenuImageDisplayUrl(existing?.image_url);
  const existingVideoUrl = resolveMenuImageDisplayUrl(existing?.video_url);
  const [picked, setPicked] = useState<PickedPhoto | null>(null);
  const [stripImage, setStripImage] = useState(false);
  const [effect, setEffect] = useState<EffectChoice>(
    isDishVideoEffect(existing?.video_effect) ? existing.video_effect : DEFAULT_DISH_VIDEO_EFFECT,
  );
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [generating, setGenerating] = useState(false);
  const [videoError, setVideoError] = useState<'unsupported' | 'failed' | null>(null);
  const [previewUrls, setPreviewUrls] = useState<{ original: string; enhanced: string | null } | null>(null);
  const genToken = useRef(0);

  const chosenFile = picked ? (picked.useEnhanced && picked.enhanced ? picked.enhanced : picked.original) : null;
  const imageChanged = Boolean(picked) || (stripImage && existingImageUrl != null);
  const hasPhoto = picked != null || (!stripImage && existingImageUrl != null);
  const effectActive = canManageDishVideo && hasPhoto && effect !== 'none';

  useEffect(() => {
    if (!picked) {
      setPreviewUrls(null);
      return;
    }
    const original = URL.createObjectURL(picked.original);
    const enhanced = picked.enhanced ? URL.createObjectURL(picked.enhanced) : null;
    setPreviewUrls({ original, enhanced });
    return () => {
      URL.revokeObjectURL(original);
      if (enhanced) URL.revokeObjectURL(enhanced);
    };
  }, [picked]);

  useEffect(() => () => {
    if (generated) URL.revokeObjectURL(generated.previewUrl);
  }, [generated]);

  /** Encode from the photo that will be saved (new pick, else the stored photo). */
  const regenerate = useCallback(
    async (source: File | null, nextEffect: EffectChoice) => {
      const token = ++genToken.current;
      setGenerated(null);
      setVideoError(null);
      if (!canManageDishVideo || nextEffect === 'none') {
        setGenerating(false);
        return;
      }
      if (!dishVideoEncodingSupported()) {
        setGenerating(false);
        setVideoError('unsupported');
        return;
      }
      setGenerating(true);
      try {
        const photo = source ?? (existingImageUrl ? await (await fetch(existingImageUrl)).blob() : null);
        if (!photo) throw new Error('no_photo');
        const out = await encodeDishVideos(photo, nextEffect);
        if (token !== genToken.current) return;
        setGenerated({ ...out, effect: nextEffect, previewUrl: URL.createObjectURL(out.detail) });
      } catch {
        if (token === genToken.current) setVideoError('failed');
      } finally {
        if (token === genToken.current) setGenerating(false);
      }
    },
    [canManageDishVideo, existingImageUrl],
  );

  // Old dish with a photo but no video: prepare one with the default effect on open.
  useEffect(() => {
    if (canManageDishVideo && existingImageUrl && !existingVideoUrl) {
      void regenerate(null, DEFAULT_DISH_VIDEO_EFFECT);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount (fresh key per modal open)
  }, []);

  useEffect(() => {
    onDraftChange({
      file: chosenFile,
      stripImage: stripImage && !picked,
      video: effectActive && generated ? { detail: generated.detail, rail: generated.rail, effect: generated.effect } : null,
      // Photo unchanged but staff picked "none": drop the stored videos.
      stripVideo: canManageDishVideo && !imageChanged && existingVideoUrl != null && effect === 'none',
      busy: generating,
    });
  }, [chosenFile, stripImage, picked, effectActive, generated, canManageDishVideo, imageChanged, existingVideoUrl, effect, generating, onDraftChange]);

  const onPick = async (fileList: FileList | null) => {
    const raw = fileList?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!raw) return;
    const original = await compressMenuImageForUpload(raw);
    const msg = validateMenuImageFile(original, {
      imageTooLarge: t.imageTooLarge,
      imageTypeInvalid: t.imageTypeInvalid,
    });
    if (msg) {
      onImageError(msg);
      return;
    }
    onImageError('');
    let quality: MenuImageQuality | null = null;
    let enhanced: File | null = null;
    try {
      const bitmap = await createImageBitmap(raw);
      try {
        quality = measureMenuImageQuality(bitmap);
        if (menuImageNeedsEnhance(quality)) {
          enhanced = await compressMenuImageForUpload(await enhanceMenuImageFile(bitmap, raw.name));
        }
      } finally {
        bitmap.close();
      }
    } catch {
      enhanced = null;
    }
    const next: PickedPhoto = {
      original,
      enhanced,
      quality: quality ?? { width: 0, height: 0, sharpness: 0, lowRes: false, blurry: false },
      useEnhanced: enhanced != null,
    };
    setPicked(next);
    setStripImage(false);
    void regenerate(next.useEnhanced && next.enhanced ? next.enhanced : next.original, effect);
  };

  const chooseEnhanced = (useEnhanced: boolean) => {
    if (!picked || picked.useEnhanced === useEnhanced) return;
    const next = { ...picked, useEnhanced };
    setPicked(next);
    void regenerate(useEnhanced && next.enhanced ? next.enhanced : next.original, effect);
  };

  const chooseEffect = (next: EffectChoice) => {
    setEffect(next);
    void regenerate(chosenFile, next);
  };

  const removePhoto = () => {
    genToken.current++;
    setPicked(null);
    setStripImage(true);
    setGenerated(null);
    setGenerating(false);
    setVideoError(null);
  };

  const stillSrc = previewUrls
    ? picked?.useEnhanced && previewUrls.enhanced
      ? previewUrls.enhanced
      : previewUrls.original
    : !stripImage
      ? existingImageUrl
      : null;
  const unchangedExistingVideo =
    canManageDishVideo && !imageChanged && generated == null && !generating && effect !== 'none'
      ? existingVideoUrl
      : null;
  const videoSrc = effectActive ? generated?.previewUrl ?? unchangedExistingVideo : null;
  const lossWarning = !canManageDishVideo && dishVideoPro && existingVideoUrl != null && imageChanged;

  let status = '';
  if (videoError === 'unsupported') status = t.dishVideoUnsupported;
  else if (videoError === 'failed') status = t.dishVideoFailed;
  else if (generating) status = t.dishVideoGenerating;
  else if (effect === 'none') status = t.dishVideoNoneHint;
  else if (generated) status = t.dishVideoReady.replace('{size}', kb(generated.detail.size));
  else if (unchangedExistingVideo) status = t.dishVideoExisting;

  const qualityReason = picked?.enhanced
    ? [
        picked.quality.lowRes
          ? t.imageQualityLowRes.replace('{w}', String(picked.quality.width)).replace('{h}', String(picked.quality.height))
          : '',
        picked.quality.blurry ? t.imageQualityBlurry : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <div className="rounded-xl border-2 border-dashed border-brand-gold/35 bg-brand-bg/40 p-4 space-y-3">
      <div>
        <span className="text-brand-gold mr-2" aria-hidden>📷</span>
        <span className="text-sm text-brand-text font-medium">{t.dishPhoto}</span>
      </div>
      <p className="text-[13px] text-brand-text-muted">{t.dishPhotoHint}</p>
      {imageError ? <p className="mesa-alert-danger text-[13px] px-3 py-2">{imageError}</p> : null}
      <input
        ref={fileInputRef}
        type="file"
        accept={MENU_IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => void onPick(e.target.files)}
      />
      <div className="flex flex-wrap items-start gap-3">
        <div
          className={`relative ${hasPhoto ? 'w-60 max-w-full' : 'w-24'} ${MENU_IMAGE_ASPECT_CLASS} rounded-xl overflow-hidden ${
            hasPhoto ? MENU_IMAGE_WELL_BG_CLASS : 'bg-brand-card/80'
          } border border-brand-border shrink-0`}
        >
          {videoSrc ? (
            <video
              key={videoSrc}
              src={videoSrc}
              muted
              loop
              autoPlay
              playsInline
              className={`h-full w-full ${MENU_IMAGE_OBJECT_FIT_CLASS}`}
            />
          ) : stillSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob: preview + stored photo
            <img src={stillSrc} alt="" className={`h-full w-full ${MENU_IMAGE_OBJECT_FIT_CLASS}`} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl text-brand-text-muted">
              -
            </div>
          )}
          {hasPhoto && canManageDishVideo ? (
            <span className="absolute left-1.5 top-1.5 rounded bg-black/65 px-1.5 text-[11px] text-white">
              {videoSrc ? t.dishVideoPreviewTag : t.dishPhotoPreviewTag}
            </span>
          ) : null}
          {generating ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/35 text-xs text-white">
              <Spinner className="h-4 w-4" />
              {t.dishVideoGenerating}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            {t.pickImage}
          </Button>
          {hasPhoto ? (
            <Button type="button" variant="outline" size="sm" onClick={removePhoto}>
              {t.removeImage}
            </Button>
          ) : null}
        </div>
      </div>

      {picked?.enhanced && previewUrls?.enhanced ? (
        <div className="mesa-alert-warning rounded-xl p-3 space-y-2.5">
          <p className="text-[13px] text-brand-text">{t.imageQualityPrompt.replace('{reason}', qualityReason)}</p>
          <div className="grid grid-cols-2 gap-2.5">
            {([
              [false, previewUrls.original, t.imageQualityOriginal, picked.quality.width, picked.quality.height],
              [true, previewUrls.enhanced, t.imageQualityEnhanced, null, null],
            ] as const).map(([useEnhanced, src, label]) => (
              <button
                key={String(useEnhanced)}
                type="button"
                aria-pressed={picked.useEnhanced === useEnhanced}
                onClick={() => chooseEnhanced(useEnhanced)}
                className={`min-w-0 rounded-lg border-2 p-0 text-left ${
                  picked.useEnhanced === useEnhanced ? 'border-brand-gold' : 'border-transparent'
                }`}
              >
                <span className={`relative block ${MENU_IMAGE_ASPECT_CLASS} overflow-hidden rounded-md ${MENU_IMAGE_WELL_BG_CLASS}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- blob: comparison crop */}
                  <img src={src} alt="" className="h-full w-full scale-[2] object-cover" />
                  <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">
                    {t.imageQualityZoom}
                  </span>
                </span>
                <span
                  className={`block px-1 py-1 text-xs ${
                    picked.useEnhanced === useEnhanced ? 'text-brand-gold font-medium' : 'text-brand-text-muted'
                  }`}
                >
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {lossWarning ? (
        <p className="mesa-alert-warning rounded-lg px-3 py-2 text-[13px]">
          {t.dishVideoWillBeRemoved}
        </p>
      ) : null}

      {canManageDishVideo && hasPhoto ? (
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[13px] text-brand-text-muted">
            {t.dishVideoTitle}
            <ProFeatureBadge label={proBadgeLabel} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[...DISH_VIDEO_EFFECTS, 'none' as const].map((key) => {
              const active = effect === key;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={generating}
                  aria-pressed={active}
                  onClick={() => chooseEffect(key)}
                  className={`text-[13px] px-2.5 py-1 disabled:opacity-50 ${mesaSelectionChipShellClass} ${mesaSelectionChipSoftClass(active)}`}
                >
                  {key === 'none' ? t.dishVideoEffectNone : t[DISH_VIDEO_EFFECT_MESSAGE_KEYS[key].label]}
                  {key === 'none' ? null : (
                    <span className="ml-1 text-[11px] text-brand-text-muted">
                      {t[DISH_VIDEO_EFFECT_MESSAGE_KEYS[key].hint]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {status ? <p className="mt-2 text-xs text-brand-text-muted">{status}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
