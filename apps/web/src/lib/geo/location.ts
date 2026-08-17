export type GeoPosition = {
  lat: number;
  lon: number;
};

export type GeolocationStatus =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'timeout';

export type GeolocationResult = {
  position: GeoPosition;
  status: GeolocationStatus;
};

export function requestCurrentPosition(
  options?: PositionOptions,
): Promise<GeolocationResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve({
      position: { lat: 0, lon: 0 },
      status: 'unavailable',
    });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          position: {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          },
          status: 'granted',
        });
      },
      (error) => {
        let status: GeolocationStatus = 'unavailable';
        if (error.code === error.PERMISSION_DENIED) {
          status = 'denied';
        } else if (error.code === error.TIMEOUT) {
          status = 'timeout';
        }
        resolve({
          position: { lat: 0, lon: 0 },
          status,
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 60_000,
        ...options,
      },
    );
  });
}

export function buildNavigationUrls(lat: number, lon: number): {
  googleMaps: string;
  appleMaps: string;
  geo: string;
} {
  return {
    googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`,
    appleMaps: `https://maps.apple.com/?daddr=${lat},${lon}`,
    geo: `geo:${lat},${lon}`,
  };
}

export function historyRangeForPeriod(
  period: '24h' | '7d' | '30d' | '90d',
): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);

  switch (period) {
    case '24h':
      from.setHours(from.getHours() - 24);
      break;
    case '7d':
      from.setDate(from.getDate() - 7);
      break;
    case '30d':
      from.setDate(from.getDate() - 30);
      break;
    case '90d':
      from.setDate(from.getDate() - 90);
      break;
  }

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}
