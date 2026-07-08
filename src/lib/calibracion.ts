import type { AsadoFeedback } from '../types';

const STORAGE_KEY = 'calibracionGlobal';
const DEFAULT_K = 1;
const MIN_K = 0.6;
const MAX_K = 1.5;

export function obtenerK(): number {
  if (typeof window === 'undefined') return DEFAULT_K;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  const parsed = stored ? Number.parseFloat(stored) : DEFAULT_K;

  return Number.isFinite(parsed) ? Math.min(MAX_K, Math.max(MIN_K, parsed)) : DEFAULT_K;
}

export function actualizarK(feedback: AsadoFeedback): number {
  const actual = obtenerK();
  const deltaByFeedback: Record<AsadoFeedback, number> = {
    perfecto: 0,
    sobro: -0.05,
    falto: 0.12,
  };

  const nuevo = Math.min(MAX_K, Math.max(MIN_K, actual + deltaByFeedback[feedback]));
  window.localStorage.setItem(STORAGE_KEY, nuevo.toString());
  return nuevo;
}

export function formatK(value: number): string {
  return `${value.toFixed(2)}x`;
}
