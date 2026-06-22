export type CutType =
  | 'sin_hueso'
  | 'con_hueso'
  | 'premium'
  | 'cerdo'
  | 'pollo'
  | 'mixto_cerdo'
  | 'mixto_pollo';

export type ScenarioType = 'quincho' | 'chulengo' | 'afuera';

export type ChecklistCategory =
  | 'carnes'
  | 'fuego'
  | 'bebidas'
  | 'acompanamientos'
  | 'otros';

export type AsadoFeedback = 'perfecto' | 'sobro' | 'falto';

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
  category: ChecklistCategory;
  checked: boolean;
  custom?: boolean;
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
  cerdoQty: number;
  polloQty: number;
  bolsasCarbon: number;
  bolsasLena: number;
  gramsByProfile: {
    hombres: number;
    mujeres: number;
    ninos: number;
  };
  meatBreakdown: Array<{
    label: string;
    amount: number;
  }>;
}

export interface SplitCostConfig {
  meatPricePerKg: number;
  carbonPricePerBag: number;
  extraExpenses: number;
}

export interface ExtrasConfig {
  includeAlcohol: boolean;
  saladMode: 'simple' | 'abundante';
  breadMode: 'normal' | 'generoso';
}

export interface ExtrasPlan {
  waterLiters: number;
  sodaLiters: number;
  beerLiters: number;
  wineBottles: number;
  iceKg: number;
  breadKg: number;
  saladKg: number;
  potatoesKg: number;
  provoletaUnits: number;
  chimichurriJars: number;
}

export interface ForecastSlot {
  time: string;
  label: string;
  temp: number;
  wind: number;
  gust: number;
  precipitationProbability: number;
  score: number;
  status: 'ideal' | 'usable' | 'riesgoso';
  reason: string;
}

export interface ForecastState {
  loading: boolean;
  updatedAt: string | null;
  slots: ForecastSlot[];
  bestSlot: ForecastSlot | null;
  error: string | null;
}

export interface SavedAsadoSession {
  id: string;
  date: string;
  people: number;
  cutType: CutType;
  scenario: ScenarioType;
  temp: number;
  wind: number;
  meatKg: number;
  carbonKg: number;
  costPerPerson: number;
  feedback: AsadoFeedback;
}
