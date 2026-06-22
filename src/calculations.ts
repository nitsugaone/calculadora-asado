import {
  AsadoFeedback,
  AsadoResult,
  CutType,
  ExtrasConfig,
  ExtrasPlan,
  ForecastSlot,
  SavedAsadoSession,
  ScenarioType,
} from './types';

type MeatPart = 'vacio' | 'tira' | 'cerdo' | 'pollo';

interface CutTypeConfig {
  label: string;
  shortLabel: string;
  grams: {
    hombres: number;
    mujeres: number;
    ninos: number;
  };
  mix: Array<{
    part: MeatPart;
    label: string;
    share: number;
  }>;
}

export const CUT_TYPE_OPTIONS: Array<[CutType, string]> = [
  ['premium', 'Premium mix'],
  ['con_hueso', 'Vacuno con hueso'],
  ['sin_hueso', 'Vacuno sin hueso'],
  ['cerdo', 'Cerdo'],
  ['pollo', 'Pollo'],
  ['mixto_cerdo', 'Vacuno + cerdo'],
  ['mixto_pollo', 'Vacuno + pollo'],
];

const CUT_TYPE_CONFIG: Record<CutType, CutTypeConfig> = {
  sin_hueso: {
    label: 'Vacuno sin hueso',
    shortLabel: 'Sin hueso',
    grams: { hombres: 400, mujeres: 300, ninos: 185 },
    mix: [{ part: 'vacio', label: 'Vacío / cortes sin hueso', share: 1 }],
  },
  con_hueso: {
    label: 'Vacuno con hueso',
    shortLabel: 'Con hueso',
    grams: { hombres: 550, mujeres: 400, ninos: 250 },
    mix: [{ part: 'tira', label: 'Tira / cortes con hueso', share: 1 }],
  },
  premium: {
    label: 'Premium mix',
    shortLabel: 'Premium mix',
    grams: { hombres: 480, mujeres: 360, ninos: 220 },
    mix: [
      { part: 'vacio', label: 'Vacío', share: 0.5 },
      { part: 'tira', label: 'Tira', share: 0.5 },
    ],
  },
  cerdo: {
    label: 'Cerdo',
    shortLabel: 'Cerdo',
    grams: { hombres: 450, mujeres: 330, ninos: 220 },
    mix: [{ part: 'cerdo', label: 'Cerdo', share: 1 }],
  },
  pollo: {
    label: 'Pollo',
    shortLabel: 'Pollo',
    grams: { hombres: 600, mujeres: 450, ninos: 300 },
    mix: [{ part: 'pollo', label: 'Pollo con hueso', share: 1 }],
  },
  mixto_cerdo: {
    label: 'Mixto vacuno/cerdo',
    shortLabel: 'Vacuno + cerdo',
    grams: { hombres: 500, mujeres: 370, ninos: 230 },
    mix: [
      { part: 'vacio', label: 'Vacuno sin hueso', share: 0.45 },
      { part: 'tira', label: 'Vacuno con hueso', share: 0.25 },
      { part: 'cerdo', label: 'Cerdo', share: 0.3 },
    ],
  },
  mixto_pollo: {
    label: 'Mixto vacuno/pollo',
    shortLabel: 'Vacuno + pollo',
    grams: { hombres: 550, mujeres: 400, ninos: 260 },
    mix: [
      { part: 'vacio', label: 'Vacuno sin hueso', share: 0.25 },
      { part: 'tira', label: 'Vacuno con hueso', share: 0.35 },
      { part: 'pollo', label: 'Pollo', share: 0.4 },
    ],
  },
};

export function getCutTypeLabel(cutType: CutType) {
  return CUT_TYPE_CONFIG[cutType].label;
}

export function getCutTypeShortLabel(cutType: CutType) {
  return CUT_TYPE_CONFIG[cutType].shortLabel;
}

/**
 * Calculates food, starters, and fuel for a Patagonian asado.
 * Wind speed and low temperatures increase fuel demand outside the quincho.
 */
export function calculateAsado(
  totalPeople: number,
  cutType: CutType,
  scenario: ScenarioType,
  temp: number,
  wind: number,
  advancedDist?: { hombres: number; mujeres: number; ninos: number } | null
): AsadoResult {
  let hombres = Math.round(totalPeople * 0.4);
  let mujeres = Math.round(totalPeople * 0.4);
  let ninos = totalPeople - hombres - mujeres;

  if (advancedDist) {
    hombres = advancedDist.hombres;
    mujeres = advancedDist.mujeres;
    ninos = advancedDist.ninos;
  }

  const config = CUT_TYPE_CONFIG[cutType];
  const adultMaleBase = config.grams.hombres;
  const adultFemaleBase = config.grams.mujeres;
  const childBase = config.grams.ninos;

  const totalCarne =
    (hombres * adultMaleBase + mujeres * adultFemaleBase + ninos * childBase) / 1000;

  const meatTotals: Record<MeatPart, number> = {
    vacio: 0,
    tira: 0,
    cerdo: 0,
    pollo: 0,
  };
  const meatBreakdown = config.mix.map((item) => {
    const amount = Number((totalCarne * item.share).toFixed(1));
    meatTotals[item.part] += amount;
    return {
      label: item.label,
      amount,
    };
  });

  const choriTotal = Math.ceil(hombres * 1.0 + mujeres * 0.8 + ninos * 0.5);
  const morciTotal = Math.ceil((hombres + mujeres) * 0.4 + ninos * 0.1);
  const achurasTotal = Math.round((hombres + mujeres) * 0.12 * 10) / 10;

  let factorFuego = 1.0;

  if (scenario !== 'quincho') {
    const base = scenario === 'chulengo' ? 1.1 : 1.25;
    let penFrio = temp < 15 ? (15 - temp) * 0.035 : 0;
    let penViento = (wind / 10) * 0.12;

    if (scenario === 'chulengo') {
      penFrio *= 0.5;
      penViento *= 0.3;
    }

    factorFuego = Math.min(base + penFrio + penViento, 3.0);
  }

  const baseCarbon = 4.0 + totalPeople * 0.32;
  const baseLena = 3.0 + totalPeople * 0.18;

  const carbonTotal = Number((baseCarbon * factorFuego).toFixed(1));
  const lenaTotal = Number((baseLena * factorFuego).toFixed(1));

  return {
    carneTotal: Number(totalCarne.toFixed(1)),
    choriTotal,
    morciTotal,
    achurasTotal,
    carbonTotal,
    lenaTotal,
    factorFuego: Number(factorFuego.toFixed(2)),
    vacioQty: Number(meatTotals.vacio.toFixed(1)),
    tiraQty: Number(meatTotals.tira.toFixed(1)),
    cerdoQty: Number(meatTotals.cerdo.toFixed(1)),
    polloQty: Number(meatTotals.pollo.toFixed(1)),
    bolsasCarbon: Math.ceil(carbonTotal / 4),
    bolsasLena: Math.ceil(lenaTotal / 3),
    gramsByProfile: {
      hombres: adultMaleBase,
      mujeres: adultFemaleBase,
      ninos: childBase,
    },
    meatBreakdown,
  };
}

export function calculateExtras(
  totalPeople: number,
  advancedDist: { hombres: number; mujeres: number; ninos: number } | null,
  config: ExtrasConfig
): ExtrasPlan {
  const hombres = advancedDist?.hombres ?? Math.round(totalPeople * 0.4);
  const mujeres = advancedDist?.mujeres ?? Math.round(totalPeople * 0.4);
  const ninos = advancedDist?.ninos ?? totalPeople - hombres - mujeres;
  const adults = Math.max(hombres + mujeres, 0);
  const people = Math.max(totalPeople, 1);

  const waterLiters = people * 0.55 + ninos * 0.25;
  const sodaLiters = people * 0.45 + ninos * 0.35;
  const beerLiters = config.includeAlcohol ? adults * 1.1 : 0;
  const wineBottles = config.includeAlcohol ? Math.ceil(adults / 4) : 0;
  const iceKg = Math.max(2, Math.ceil((waterLiters + sodaLiters + beerLiters) * 0.45));
  const breadMultiplier = config.breadMode === 'generoso' ? 0.13 : 0.09;
  const saladMultiplier = config.saladMode === 'abundante' ? 0.28 : 0.18;

  return {
    waterLiters: Number(waterLiters.toFixed(1)),
    sodaLiters: Number(sodaLiters.toFixed(1)),
    beerLiters: Number(beerLiters.toFixed(1)),
    wineBottles,
    iceKg,
    breadKg: Number((people * breadMultiplier).toFixed(1)),
    saladKg: Number((people * saladMultiplier).toFixed(1)),
    potatoesKg: Number((people * 0.22).toFixed(1)),
    provoletaUnits: Math.ceil(adults / 5),
    chimichurriJars: Math.max(1, Math.ceil(people / 10)),
  };
}

export function scoreForecastSlot(
  time: string,
  temp: number,
  wind: number,
  gust: number,
  precipitationProbability: number
): ForecastSlot {
  const hour = new Date(time).getHours();
  const isCookingWindow = hour >= 11 && hour <= 23;
  let score = 100;

  score -= Math.max(0, wind - 15) * 1.2;
  score -= Math.max(0, gust - 25) * 1.5;
  score -= Math.max(0, 8 - temp) * 2.2;
  score -= precipitationProbability * 0.45;
  if (!isCookingWindow) score -= 35;

  const roundedScore = Math.max(0, Math.round(score));
  let status: ForecastSlot['status'] = 'ideal';
  let reason = 'Buen margen para sostener brasas parejas.';

  if (gust >= 70 || wind >= 55 || precipitationProbability >= 75) {
    status = 'riesgoso';
    reason = 'Rafagas o lluvia con riesgo alto para prender fuego afuera.';
  } else if (roundedScore < 62 || gust >= 45 || wind >= 35 || precipitationProbability >= 45) {
    status = 'usable';
    reason = 'Se puede, pero conviene usar reparo y cargar mas brasa.';
  }

  if (!isCookingWindow) {
    reason = 'Horario poco practico para cocinar, aunque el clima pueda ayudar.';
  }

  return {
    time,
    label: formatForecastLabel(time),
    temp,
    wind,
    gust,
    precipitationProbability,
    score: roundedScore,
    status,
    reason,
  };
}

export function getFeedbackAdjustment(history: SavedAsadoSession[]) {
  const recent = history.slice(0, 5);
  const faltaron = recent.filter((session) => session.feedback === 'falto').length;
  const sobraron = recent.filter((session) => session.feedback === 'sobro').length;

  if (faltaron >= 2) {
    return {
      title: 'Tu historial pide un margen extra',
      message: 'En los ultimos asados falto comida. Suma 8-10% de carne o choris para este grupo.',
      tone: 'text-white border-[#ea580c]/40 bg-[#ea580c]/10',
    };
  }

  if (sobraron >= 2) {
    return {
      title: 'Tu historial viene generoso',
      message: 'En los ultimos asados sobro bastante. Podes bajar 5-8% la carne si hay muchos extras.',
      tone: 'text-sky-300 border-sky-500/30 bg-sky-500/10',
    };
  }

  return {
    title: 'Historial equilibrado',
    message: 'Todavia no hay tendencia fuerte. Guarda 2 o 3 asados mas para calibrar cantidades.',
    tone: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  };
}

function formatForecastLabel(time: string) {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

export function getWeatherAdvice(scenario: ScenarioType, temp: number, wind: number) {
  if (scenario === 'quincho') {
    return {
      message: 'Refugio garantizado: en el quincho el viento austral no apaga las brasas.',
      color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
      isSafe: true,
    };
  }

  if (wind >= 70) {
    return {
      message:
        'Riesgo extremo: ráfagas de más de 70 km/h. Es muy difícil mantener calor estable y no conviene prender fuego afuera.',
      color: 'text-rose-400 border-rose-500/30 bg-rose-500/10 animate-pulse',
      isSafe: false,
    };
  }

  if (wind >= 45) {
    return {
      message:
        'Viento severo (>45 km/h). Ubicá el chulengo de espaldas al viento y protegé las cenizas.',
      color: 'text-white border-[#ea580c]/40 bg-[#ea580c]/10',
      isSafe: true,
    };
  }

  if (temp <= 5) {
    return {
      message:
        'Clima antártico. La pérdida de calor sube mucho: agregá leña para sostener el brasero.',
      color: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
      isSafe: true,
    };
  }

  if (wind >= 20) {
    return {
      message: 'Brisa patagónica activa. El consumo de carbón se acelera un poco.',
      color: 'text-white border-[#ea580c]/30 bg-[#ea580c]/10',
      isSafe: true,
    };
  }

  return {
    message: 'Clima inusualmente calmo para Río Gallegos. Buenas condiciones para el fuego.',
    color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    isSafe: true,
  };
}

export interface SetupThermodynamics {
  efficiency: number;
  heatLossMechanism: string;
  proTips: string[];
}

export interface ThermodynamicTips {
  chulengo: SetupThermodynamics;
  openFire: SetupThermodynamics;
  climateSummary: string;
}

export function getThermodynamicAdvice(temp: number, wind: number): ThermodynamicTips {
  if (wind >= 60) {
    return {
      climateSummary:
        'Alerta de ráfagas muy fuertes: la pérdida convectiva es extrema y enfría la brasa expuesta.',
      chulengo: {
        efficiency: 35,
        heatLossMechanism:
          'El aire entra por rendijas inferiores y arrastra calor por la chimenea de forma agresiva.',
        proTips: [
          'Cerrá chimenea y compuerta casi por completo para encapsular calor.',
          'Estabilizá el chulengo con peso en las patas o reparo lateral.',
          'Cargá brasas ya encendidas por tandas chicas para no perder temperatura.',
        ],
      },
      openFire: {
        efficiency: 10,
        heatLossMechanism:
          'El viento inclina el gradiente térmico y disipa el calor antes de que llegue a la carne.',
        proTips: [
          'Levantá un reparo físico a barlovento con chapa, pared o vehículo bien ubicado.',
          'Concentrá una cama gruesa de brasas para compensar la pérdida lateral.',
          'Humedecé el perímetro del suelo para reducir chispas voladoras.',
        ],
      },
    };
  }

  if (wind >= 35) {
    return {
      climateSummary:
        'Viento patagónico activo: hay enfriamiento lateral constante por ráfagas intensas.',
      chulengo: {
        efficiency: 60,
        heatLossMechanism:
          'El viento enfría la chapa expuesta y crea un diferencial frío en los costados.',
        proTips: [
          'Mantené la tapa cerrada la mayor parte del tiempo.',
          'Arrancá con los cortes con hueso hacia abajo para estabilizar calor.',
          'Sumá astillas de ñire para recuperar temperatura por conducción superior.',
        ],
      },
      openFire: {
        efficiency: 25,
        heatLossMechanism:
          'La brasa se enfría y la ceniza empieza a aislar el núcleo caliente.',
        proTips: [
          'Armá un foso bajo o rodeá el fuego con piedras pesadas.',
          'Usá iniciadores sólidos y leños medianos entrelazados.',
          'Alimentá un brasero paralelo para no sufrir bajones de temperatura.',
        ],
      },
    };
  }

  if (temp <= 5) {
    return {
      climateSummary:
        'Helada con fuerte gradiente de calor: sube la pérdida hacia el suelo y el aire frío.',
      chulengo: {
        efficiency: 70,
        heatLossMechanism:
          'La chapa fría disipa rápidamente el calor acumulado.',
        proTips: [
          'Precalentá el chulengo durante 25 minutos antes de apoyar la carne.',
          'Evitá abrir la tapa salvo para movimientos necesarios.',
          'Usá una cama inicial generosa de brasas antes de empezar.',
        ],
      },
      openFire: {
        efficiency: 40,
        heatLossMechanism:
          'El suelo helado roba calor y reduce la radiación útil hacia la parrilla.',
        proTips: [
          'No apoyes brasas directamente sobre tierra congelada.',
          'Concentrá las brasas en un perímetro reducido.',
          'Usá una chapa o pantalla detrás de la parrilla para devolver radiación.',
        ],
      },
    };
  }

  if (wind >= 20 || temp <= 12) {
    return {
      climateSummary:
        'Condiciones clásicas de Santa Cruz: brisa y frío moderado, con pérdida térmica manejable.',
      chulengo: {
        efficiency: 80,
        heatLossMechanism:
          'Pérdida convectiva leve a través de los tiros abiertos.',
        proTips: [
          'Mantené el regulador de tiro cerca de 30% de apertura.',
          'Distribuí las brasas en herradura para envolver carnes y achuras.',
        ],
      },
      openFire: {
        efficiency: 55,
        heatLossMechanism:
          'Pérdida por radiación lateral sin reparo atmosférico.',
        proTips: [
          'Usá leña dura de calafate o ñire para brasas compactas.',
          'Mantené un brasero paralelo para alimentar el fuego principal.',
        ],
      },
    };
  }

  return {
    climateSummary:
      'Día calmo y templado: radiación limpia y estabilidad térmica.',
    chulengo: {
      efficiency: 95,
      heatLossMechanism: 'Pérdida casi nula; máxima eficiencia térmica.',
      proTips: [
        'Cociná con tapa abierta o cerrada según el dorado buscado.',
        'Mantené brasas ligeras y espaciadas para no arrebatar la grasa.',
      ],
    },
    openFire: {
      efficiency: 80,
      heatLossMechanism:
        'Escape radiativo normal hacia arriba, ideal para cocción tradicional.',
      proTips: [
        'Buen día para cocción lenta de tira con leño entero.',
        'Sostené fuego medio y parejo a unos 20-25 cm de la parrilla.',
      ],
    },
  };
}
