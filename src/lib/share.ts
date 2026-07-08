import type { CutType, ScenarioType } from '../types';

export interface SharedState {
  com: number;
  ent: ScenarioType;
  tmp: number;
  wnd: number;
  cut: CutType;
  np: number;
  pKg: number;
  pCoal: number;
  ext: number;
  tot: number;
  cab: number;
}

function encodeState(state: SharedState): string {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function generarUrlCompartible(state: SharedState): string {
  const encoded = encodeState(state);
  const basePath = window.location.pathname.startsWith('/calculadora-asado')
    ? '/calculadora-asado/'
    : '/';

  return `${window.location.origin}${basePath}?state=${encodeURIComponent(encoded)}`;
}

export function decodificarUrlCompartible(encoded: string): SharedState | null {
  try {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}
