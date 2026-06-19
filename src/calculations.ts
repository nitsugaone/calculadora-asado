import { CutType, ScenarioType, AsadoResult } from './types';

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

  const adultMaleBase = cutType === 'con_hueso' ? 550 : cutType === 'premium' ? 480 : 400;
  const adultFemaleBase = cutType === 'con_hueso' ? 400 : cutType === 'premium' ? 360 : 300;
  const childBase = cutType === 'con_hueso' ? 250 : cutType === 'premium' ? 220 : 185;

  const totalCarne =
    (hombres * adultMaleBase + mujeres * adultFemaleBase + ninos * childBase) / 1000;

  let vacioQty = 0;
  let tiraQty = 0;
  if (cutType === 'premium') {
    vacioQty = totalCarne * 0.5;
    tiraQty = totalCarne * 0.5;
  } else if (cutType === 'sin_hueso') {
    vacioQty = totalCarne;
  } else {
    tiraQty = totalCarne;
  }

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
    vacioQty: Number(vacioQty.toFixed(1)),
    tiraQty: Number(tiraQty.toFixed(1)),
    bolsasCarbon: Math.ceil(carbonTotal / 4),
    bolsasLena: Math.ceil(lenaTotal / 3),
  };
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
      color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
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
      color: 'text-amber-300 border-amber-500/20 bg-amber-500/5',
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
