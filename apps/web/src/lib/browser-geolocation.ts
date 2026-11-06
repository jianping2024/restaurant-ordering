/**
 * Sole browser geolocation for fence work: settings anchor + guest fence checks.
 * Prefer high-accuracy GPS; if that fails, one coarse network attempt.
 */
export async function getBrowserPositionForGeoFence(): Promise<GeolocationPosition> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    throw new Error('not-supported');
  }

  const attempt = (options: PositionOptions) =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });

  try {
    return await attempt({
      enableHighAccuracy: true,
      timeout: 8_000,
      maximumAge: 0,
    });
  } catch {
    return attempt({
      enableHighAccuracy: false,
      timeout: 20_000,
      maximumAge: 120_000,
    });
  }
}
