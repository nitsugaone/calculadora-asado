import type { AsadoFeedback, ScenarioType } from '../types';

const LOGS_KEY = 'asadoLogs';

export interface AsadoLog {
  id: string;
  timestamp: number;
  comensalesCount: number;
  entorno: ScenarioType;
  clima: { temp: number; viento: number };
  calculado: { carneKg: number; carbonKg: number };
  precios?: { totalARS: number; porCabeza: number };
  feedback?: {
    estadoCarne: AsadoFeedback;
    estadoCarbon: AsadoFeedback;
    ajusteAplicado: boolean;
  };
}

export function leerLogs(): AsadoLog[] {
  if (typeof window === 'undefined') return [];

  try {
    return JSON.parse(window.localStorage.getItem(LOGS_KEY) || '[]');
  } catch {
    window.localStorage.removeItem(LOGS_KEY);
    return [];
  }
}

export function guardarLog(log: AsadoLog) {
  const historial = leerLogs();
  historial.push(log);
  window.localStorage.setItem(LOGS_KEY, JSON.stringify(historial.slice(-40)));
}
