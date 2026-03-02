import Constants from 'expo-constants';
import * as Location from 'expo-location';

export type ReverseGeocodeProvider = 'system' | 'amap';

type GeocodingConfig = {
  provider: ReverseGeocodeProvider;
  amapWebKey?: string;
};

const EARTH_A = 6378245.0;
const EARTH_EE = 0.00669342162296594323;
const PI = Math.PI;

function devLog(message: string, payload?: unknown) {
  if (!__DEV__) {
    return;
  }
  if (payload === undefined) {
    console.log(`[reverse-geocode] ${message}`);
    return;
  }
  console.log(`[reverse-geocode] ${message}`, payload);
}

type AmapRegeocodeResponse = {
  status?: string;
  info?: string;
  infocode?: string;
  regeocode?: {
    formatted_address?: string;
    addressComponent?: {
      province?: string;
      city?: string | string[];
      district?: string;
      township?: string;
      neighborhood?: { name?: string };
      building?: { name?: string };
      streetNumber?: { street?: string; number?: string };
    };
  };
};

function formatSystemPlaceName(address?: Location.LocationGeocodedAddress) {
  if (!address) {
    return undefined;
  }

  const parts = [
    address.name,
    address.street,
    address.district,
    address.city,
    address.region,
    address.country,
  ]
    .filter((item): item is string => Boolean(item && item.trim()))
    .map((item) => item.trim());

  if (parts.length === 0) {
    return undefined;
  }

  return Array.from(new Set(parts)).join(' · ');
}

function normalizeAmapCity(city?: string | string[]) {
  if (!city) {
    return undefined;
  }
  if (Array.isArray(city)) {
    const first = city.find((item) => item && item.trim());
    return first?.trim();
  }
  const normalized = city.trim();
  return normalized || undefined;
}

function formatAmapPlaceName(data: AmapRegeocodeResponse) {
  const formatted = data.regeocode?.formatted_address?.trim();
  if (formatted) {
    return formatted;
  }

  const component = data.regeocode?.addressComponent;
  if (!component) {
    return undefined;
  }

  const streetName = [
    component.streetNumber?.street,
    component.streetNumber?.number,
  ]
    .filter((item): item is string => Boolean(item && item.trim()))
    .join('');

  const parts = [
    component.province,
    normalizeAmapCity(component.city),
    component.district,
    component.township,
    component.neighborhood?.name,
    component.building?.name,
    streetName,
  ]
    .filter((item): item is string => Boolean(item && item.trim()))
    .map((item) => item.trim());

  if (parts.length === 0) {
    return undefined;
  }

  return Array.from(new Set(parts)).join(' · ');
}

function getGeocodingConfig(): GeocodingConfig {
  const extra = (Constants.expoConfig?.extra ?? {}) as {
    geocoding?: { provider?: string; amapWebKey?: string };
  };
  const rawProvider = extra.geocoding?.provider;
  const provider: ReverseGeocodeProvider =
    rawProvider === 'amap' ? 'amap' : 'system';

  return {
    provider,
    amapWebKey: extra.geocoding?.amapWebKey,
  };
}

function isOutOfChina(latitude: number, longitude: number) {
  return (
    longitude < 72.004 ||
    longitude > 137.8347 ||
    latitude < 0.8293 ||
    latitude > 55.8271
  );
}

function transformLat(x: number, y: number) {
  let ret =
    -100.0 +
    2.0 * x +
    3.0 * y +
    0.2 * y * y +
    0.1 * x * y +
    0.2 * Math.sqrt(Math.abs(x));
  ret +=
    ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) /
    3.0;
  ret +=
    ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0;
  ret +=
    ((160.0 * Math.sin((y / 12.0) * PI) + 320 * Math.sin((y * PI) / 30.0)) *
      2.0) /
    3.0;
  return ret;
}

function transformLng(x: number, y: number) {
  let ret =
    300.0 +
    x +
    2.0 * y +
    0.1 * x * x +
    0.1 * x * y +
    0.1 * Math.sqrt(Math.abs(x));
  ret +=
    ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) /
    3.0;
  ret +=
    ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0;
  ret +=
    ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) *
      2.0) /
    3.0;
  return ret;
}

function wgs84ToGcj02(latitude: number, longitude: number) {
  if (isOutOfChina(latitude, longitude)) {
    return { latitude, longitude };
  }

  const dLat = transformLat(longitude - 105.0, latitude - 35.0);
  const dLng = transformLng(longitude - 105.0, latitude - 35.0);
  const radLat = (latitude / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EARTH_EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  const mgLat =
    latitude +
    (dLat * 180.0) / (((EARTH_A * (1 - EARTH_EE)) / (magic * sqrtMagic)) * PI);
  const mgLng =
    longitude + (dLng * 180.0) / ((EARTH_A / sqrtMagic) * Math.cos(radLat) * PI);

  return { latitude: mgLat, longitude: mgLng };
}

async function reverseGeocodeWithSystem(latitude: number, longitude: number) {
  const addresses = await Location.reverseGeocodeAsync({
    latitude,
    longitude,
  });
  return formatSystemPlaceName(addresses[0]);
}

async function reverseGeocodeWithAmap(
  latitude: number,
  longitude: number,
  amapWebKey: string
) {
  const gcj02 = wgs84ToGcj02(latitude, longitude);
  devLog('amap input coords transformed', {
    from: { latitude, longitude },
    to: gcj02,
  });
  const location = `${gcj02.longitude},${gcj02.latitude}`;
  const url = `https://restapi.amap.com/v3/geocode/regeo?key=${encodeURIComponent(
    amapWebKey
  )}&location=${encodeURIComponent(
    location
  )}&extensions=base&output=JSON&language=zh_cn`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`AMap reverse geocode failed: ${response.status}`);
  }

  const data = (await response.json()) as AmapRegeocodeResponse;
  if (data.status !== '1') {
    throw new Error(
      `AMap reverse geocode invalid status: status=${data.status ?? 'N/A'} info=${
        data.info ?? 'N/A'
      } infocode=${data.infocode ?? 'N/A'}`
    );
  }
  return formatAmapPlaceName(data);
}

export async function reverseGeocodePlaceName(
  latitude: number,
  longitude: number
) {
  const config = getGeocodingConfig();
  devLog('provider selected', config.provider);

  if (config.provider === 'amap' && config.amapWebKey) {
    try {
      const placeName = await reverseGeocodeWithAmap(
        latitude,
        longitude,
        config.amapWebKey
      );
      devLog('amap result', placeName);
      if (placeName) {
        return placeName;
      }
      devLog('amap empty result, fallback to system');
    } catch (error) {
      devLog(
        'amap failed, fallback to system',
        error instanceof Error ? error.message : error
      );
    }
  }

  const placeName = await reverseGeocodeWithSystem(latitude, longitude);
  devLog('system result', placeName);
  return placeName;
}
