import { useEffect, useState } from 'react';

const STORAGE_KEY = 'lastWeather';
const FORECAST_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=-51.62&longitude=-69.22&current_weather=true&wind_speed_unit=kmh';

export interface WeatherSnapshot {
  temp: number;
  wind: number;
  isReal: boolean;
  locationName: string;
  conditionText: string;
  updatedAt?: string;
}

export const FALLBACK_WEATHER: WeatherSnapshot = {
  temp: 8,
  wind: 25,
  isReal: false,
  locationName: 'Río Gallegos (referencia)',
  conditionText: 'Fallback patagónico offline',
};

export function getStoredWeatherSnapshot(): WeatherSnapshot {
  if (typeof window === 'undefined') return FALLBACK_WEATHER;

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? { ...FALLBACK_WEATHER, ...JSON.parse(saved) } : FALLBACK_WEATHER;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return FALLBACK_WEATHER;
  }
}

export function saveStoredWeatherSnapshot(snapshot: WeatherSnapshot) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...snapshot, updatedAt: new Date().toISOString() })
  );
}

export function useWeatherAutoFill(enabled = true) {
  const [weather, setWeather] = useState<WeatherSnapshot>(getStoredWeatherSnapshot);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    fetch(FORECAST_URL)
      .then((response) => response.json())
      .then((data) => {
        if (!data?.current_weather || cancelled) return;

        const live: WeatherSnapshot = {
          temp: Math.round(data.current_weather.temperature),
          wind: Math.round(data.current_weather.windspeed),
          isReal: true,
          locationName: 'Río Gallegos',
          conditionText: 'Medición Open-Meteo',
        };

        setWeather(live);
        saveStoredWeatherSnapshot(live);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return weather;
}
