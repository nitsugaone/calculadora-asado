export type CutType = 'sin_hueso' | 'con_hueso' | 'premium';

export type ScenarioType = 'quincho' | 'chulengo' | 'afuera';

export interface WeatherStatus {
  temp: number;
  wind: number;
  loading: boolean;
  isReal: boolean; // Indicates if fetched from real meteorological station or mock/manual
  locationName: string;
  conditionText: string;
  error: string | null;
}

export interface ParticipantConfig {
  hombres: number;
  mujeres: number;
  ninos: number;
}

export interface ChecklistItem {
  id: string;
  label: string;
  amount: string;
  category: 'carnes' | 'fuego' | 'bebidas' | 'acompanamientos';
  checked: boolean;
}

export interface AsadoResult {
  carneTotal: number;
  choriTotal: number;
  morciTotal: number;
  achurasTotal: number;
  carbonTotal: number;
  lenaTotal: number;
  factorFuego: number;
  vacioQty: number;
  tiraQty: number;
  bolsasCarbon: number;
  bolsasLena: number;
}

export interface SplitCostConfig {
  meatPricePerKg: number;
  carbonPricePerBag: number;
  extraExpenses: number;
}
