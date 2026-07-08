import type { ScenarioType } from '../types';

const TEMP_LOSS_ALPHA = 0.02;
const WIND_LOSS_BETA = 0.015;

const ENVIRONMENT_COEFFICIENT: Record<ScenarioType, number> = {
  quincho: 0,
  chulengo: 0.45,
  afuera: 1,
};

const roundTo = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export function calcularFactorFuego(temp: number, viento: number, entorno: ScenarioType): number {
  const coefficient = ENVIRONMENT_COEFFICIENT[entorno];
  const coldPenalty = TEMP_LOSS_ALPHA * Math.max(0, 15 - temp);
  const windPenalty = WIND_LOSS_BETA * Math.max(0, viento);

  return roundTo(1 + (coldPenalty + windPenalty) * coefficient, 2);
}

export function calcularCombustible(
  baseKg: number,
  temp: number,
  viento: number,
  entorno: ScenarioType
): number {
  return roundTo(baseKg * calcularFactorFuego(temp, viento, entorno), 1);
}

export function tieneAlertaVientoAbierto(entorno: ScenarioType, viento: number): boolean {
  return entorno === 'afuera' && viento > 50;
}
