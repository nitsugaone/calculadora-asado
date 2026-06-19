import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clock,
  CloudSun,
  DollarSign,
  Download,
  Flame,
  History,
  ListPlus,
  Minus,
  Plus,
  RefreshCw,
  Save,
  Share2,
  Trash2,
  Thermometer,
  Users,
  Wifi,
  WifiOff,
  Wind,
} from 'lucide-react';
import {
  calculateAsado,
  calculateExtras,
  getFeedbackAdjustment,
  getThermodynamicAdvice,
  getWeatherAdvice,
  scoreForecastSlot,
} from './calculations';
import {
  AsadoFeedback,
  ChecklistCategory,
  ChecklistItem,
  CutType,
  ExtrasConfig,
  ForecastState,
  ParticipantConfig,
  SavedAsadoSession,
  ScenarioType,
  SplitCostConfig,
  WeatherStatus,
} from './types';

const DEFAULT_MEAT_PRICE = 10000;
const DEFAULT_COAL_PRICE = 2200;
const DEFAULT_EXTRA_PRICE = 15000;
const HISTORY_KEY = 'asado-pro-history-v1';
const RIO_GALLEGOS_FORECAST_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=-51.623&longitude=-69.2168&current=temperature_2m,wind_speed_10m,wind_gusts_10m,weather_code,precipitation&hourly=temperature_2m,wind_speed_10m,wind_gusts_10m,precipitation_probability&forecast_days=3&timezone=America%2FArgentina%2FBuenos_Aires&wind_speed_unit=kmh';

const currency = new Intl.NumberFormat('es-AR');

const emptyForecast: ForecastState = {
  loading: false,
  updatedAt: null,
  slots: [],
  bestSlot: null,
  error: null,
};

type OpenMeteoForecast = {
  current?: {
    temperature_2m?: number;
    wind_speed_10m?: number;
    wind_gusts_10m?: number;
    weather_code?: number;
    precipitation?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    wind_speed_10m?: number[];
    wind_gusts_10m?: number[];
    precipitation_probability?: number[];
  };
};

export default function App() {
  const [totalPeople, setTotalPeople] = useState(12);
  const [demographics, setDemographics] = useState<ParticipantConfig>({
    hombres: 5,
    mujeres: 5,
    ninos: 2,
  });
  const [showAdvancedDemo, setShowAdvancedDemo] = useState(false);
  const [cutType, setCutType] = useState<CutType>('premium');
  const [scenario, setScenario] = useState<ScenarioType>('chulengo');
  const [temp, setTemp] = useState(8);
  const [wind, setWind] = useState(35);
  const [costs, setCosts] = useState<SplitCostConfig>({
    meatPricePerKg: DEFAULT_MEAT_PRICE,
    carbonPricePerBag: DEFAULT_COAL_PRICE,
    extraExpenses: DEFAULT_EXTRA_PRICE,
  });
  const [extrasConfig, setExtrasConfig] = useState<ExtrasConfig>({
    includeAlcohol: true,
    saladMode: 'simple',
    breadMode: 'normal',
  });
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [customItems, setCustomItems] = useState<ChecklistItem[]>([]);
  const [customLabel, setCustomLabel] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [customCategory, setCustomCategory] = useState<ChecklistCategory>('otros');
  const [onlineStatus, setOnlineStatus] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [weather, setWeather] = useState<WeatherStatus>({
    temp: 8,
    wind: 35,
    loading: false,
    isReal: false,
    locationName: 'Río Gallegos (manual)',
    conditionText: 'Clima ventoso de referencia',
    error: null,
  });
  const [forecast, setForecast] = useState<ForecastState>(emptyForecast);
  const [history, setHistory] = useState<SavedAsadoSession[]>([]);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!showAdvancedDemo) {
      const hombres = Math.round(totalPeople * 0.4);
      const mujeres = Math.round(totalPeople * 0.4);
      const ninos = Math.max(0, totalPeople - hombres - mujeres);
      setDemographics({ hombres, mujeres, ninos });
    }
  }, [showAdvancedDemo, totalPeople]);

  useEffect(() => {
    const handleOnline = () => setOnlineStatus(true);
    const handleOffline = () => setOnlineStatus(false);
    const handleInstallPrompt = (event: any) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const storedHistory = window.localStorage.getItem(HISTORY_KEY);
    if (storedHistory) {
      try {
        setHistory(JSON.parse(storedHistory));
      } catch {
        window.localStorage.removeItem(HISTORY_KEY);
      }
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    };
  }, []);

  const advancedDist = showAdvancedDemo ? demographics : null;
  const results = useMemo(
    () => calculateAsado(totalPeople, cutType, scenario, temp, wind, advancedDist),
    [advancedDist, cutType, scenario, temp, totalPeople, wind]
  );
  const extras = useMemo(
    () => calculateExtras(totalPeople, advancedDist, extrasConfig),
    [advancedDist, extrasConfig, totalPeople]
  );
  const adviceStatus = getWeatherAdvice(scenario, temp, wind);
  const thermoTips = getThermodynamicAdvice(temp, wind);
  const feedbackAdjustment = getFeedbackAdjustment(history);

  const totalCostEstimate =
    results.carneTotal * costs.meatPricePerKg +
    results.bolsasCarbon * costs.carbonPricePerBag +
    costs.extraExpenses;
  const costPerPerson = Math.ceil(totalCostEstimate / Math.max(totalPeople, 1));

  const checklistItems = useMemo<ChecklistItem[]>(
    () => [
      {
        id: 'c1',
        label:
          cutType === 'con_hueso'
            ? 'Carne con hueso'
            : cutType === 'sin_hueso'
              ? 'Carne sin hueso'
              : 'Premium mix',
        amount: `${results.carneTotal} kg`,
        category: 'carnes',
        checked: false,
      },
      {
        id: 'c2',
        label: 'Chorizos',
        amount: `${results.choriTotal} unidades`,
        category: 'carnes',
        checked: false,
      },
      {
        id: 'c3',
        label: 'Morcillas',
        amount: `${results.morciTotal} unidades`,
        category: 'carnes',
        checked: false,
      },
      {
        id: 'c4',
        label: 'Achuras variadas',
        amount: `${results.achurasTotal} kg`,
        category: 'carnes',
        checked: false,
      },
      {
        id: 'f1',
        label: 'Carbón vegetal',
        amount: `${results.carbonTotal} kg (${results.bolsasCarbon} bolsas)`,
        category: 'fuego',
        checked: false,
      },
      {
        id: 'f2',
        label: 'Leña dura / ñire seco',
        amount: `${results.lenaTotal} kg (${results.bolsasLena} atados)`,
        category: 'fuego',
        checked: false,
      },
      {
        id: 'b1',
        label: 'Agua',
        amount: `${extras.waterLiters} litros`,
        category: 'bebidas',
        checked: false,
      },
      {
        id: 'b2',
        label: 'Gaseosa / jugo',
        amount: `${extras.sodaLiters} litros`,
        category: 'bebidas',
        checked: false,
      },
      {
        id: 'b3',
        label: 'Cerveza',
        amount: extrasConfig.includeAlcohol ? `${extras.beerLiters} litros` : 'No incluida',
        category: 'bebidas',
        checked: false,
      },
      {
        id: 'b4',
        label: 'Vino',
        amount: extrasConfig.includeAlcohol ? `${extras.wineBottles} botellas` : 'No incluido',
        category: 'bebidas',
        checked: false,
      },
      {
        id: 'b5',
        label: 'Hielo',
        amount: `${extras.iceKg} kg`,
        category: 'bebidas',
        checked: false,
      },
      {
        id: 'a1',
        label: 'Pan',
        amount: `${extras.breadKg} kg`,
        category: 'acompanamientos',
        checked: false,
      },
      {
        id: 'a2',
        label: 'Ensaladas',
        amount: `${extras.saladKg} kg`,
        category: 'acompanamientos',
        checked: false,
      },
      {
        id: 'a3',
        label: 'Papas / guarnición caliente',
        amount: `${extras.potatoesKg} kg`,
        category: 'acompanamientos',
        checked: false,
      },
      {
        id: 'a4',
        label: 'Provoleta',
        amount: `${extras.provoletaUnits} unidades`,
        category: 'acompanamientos',
        checked: false,
      },
      {
        id: 'a5',
        label: 'Chimichurri y salsa criolla',
        amount: `${extras.chimichurriJars} frascos`,
        category: 'acompanamientos',
        checked: false,
      },
    ],
    [cutType, extras, extrasConfig.includeAlcohol, results]
  );

  useEffect(() => {
    setChecklist((previous) =>
      checklistItems.map((item) => ({
        ...item,
        checked: previous.find((prior) => prior.id === item.id)?.checked ?? false,
      }))
    );
  }, [checklistItems]);

  const allChecklist = useMemo(
    () => [...checklist, ...customItems],
    [checklist, customItems]
  );
  const checkedCount = allChecklist.filter((item) => item.checked).length;
  const progressPercent =
    allChecklist.length === 0 ? 0 : Math.round((checkedCount / allChecklist.length) * 100);

  const triggerHaptic = (pattern: number | number[]) => {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  const updatePeople = (value: number) => {
    setTotalPeople(Math.max(1, value));
    triggerHaptic(8);
  };

  const updateDemographic = (key: keyof ParticipantConfig, value: number) => {
    const next = { ...demographics, [key]: Math.max(0, value) };
    setDemographics(next);
    setTotalPeople(Math.max(1, next.hombres + next.mujeres + next.ninos));
    triggerHaptic(8);
  };

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3500);
  };

  const fetchForecast = async () => {
    triggerHaptic(20);
    setWeather((previous) => ({ ...previous, loading: true, error: null }));
    setForecast((previous) => ({ ...previous, loading: true, error: null }));

    try {
      const response = await fetch(RIO_GALLEGOS_FORECAST_URL);
      if (!response.ok) {
        throw new Error('No se pudo consultar Open-Meteo.');
      }

      const data: OpenMeteoForecast = await response.json();
      const current = data.current;
      const hourly = data.hourly;

      if (!current || !hourly?.time?.length) {
        throw new Error('Open-Meteo no devolvió datos suficientes.');
      }

      const currentTemp = Math.round(current.temperature_2m ?? temp);
      const currentWind = Math.round(current.wind_speed_10m ?? wind);
      const currentGust = Math.round(current.wind_gusts_10m ?? currentWind);
      const currentCondition = describeWeatherCode(current.weather_code);

      setWeather({
        temp: currentTemp,
        wind: currentWind,
        loading: false,
        isReal: true,
        locationName: 'Río Gallegos',
        conditionText: `${currentCondition}, ráfagas ${currentGust} km/h`,
        error: null,
      });
      setTemp(currentTemp);
      setWind(currentWind);

      const slots = hourly.time
        .map((timeValue, index) =>
          scoreForecastSlot(
            timeValue,
            Math.round(hourly.temperature_2m?.[index] ?? currentTemp),
            Math.round(hourly.wind_speed_10m?.[index] ?? currentWind),
            Math.round(hourly.wind_gusts_10m?.[index] ?? currentGust),
            Math.round(hourly.precipitation_probability?.[index] ?? 0)
          )
        )
        .filter((slot) => {
          const hour = new Date(slot.time).getHours();
          return hour >= 11 && hour <= 23;
        });

      const bestSlot = [...slots].sort((a, b) => b.score - a.score)[0] ?? null;
      const displaySlots = [...slots].sort((a, b) => b.score - a.score).slice(0, 6);

      setForecast({
        loading: false,
        updatedAt: new Date().toISOString(),
        slots: displaySlots,
        bestSlot,
        error: null,
      });
      showNotice('Pronóstico de parrilla actualizado.');
    } catch {
      setWeather((previous) => ({
        ...previous,
        loading: false,
        isReal: false,
        error: 'No se pudo conectar con Open-Meteo. Se mantienen los valores manuales.',
      }));
      setForecast((previous) => ({
        ...previous,
        loading: false,
        error: 'No se pudo cargar el pronóstico.',
      }));
    }
  };

  const triggerInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const addCustomItem = () => {
    const label = customLabel.trim();
    if (!label) return;

    setCustomItems((current) => [
      ...current,
      {
        id: `custom-${Date.now()}`,
        label,
        amount: customAmount.trim() || 'A gusto',
        category: customCategory,
        checked: false,
        custom: true,
      },
    ]);
    setCustomLabel('');
    setCustomAmount('');
    setCustomCategory('otros');
    showNotice('Ítem agregado a la lista.');
  };

  const toggleChecklistItem = (item: ChecklistItem) => {
    const updater = (entry: ChecklistItem) =>
      entry.id === item.id ? { ...entry, checked: !entry.checked } : entry;

    if (item.custom) {
      setCustomItems((current) => current.map(updater));
      return;
    }

    setChecklist((current) => current.map(updater));
  };

  const removeCustomItem = (itemId: string) => {
    setCustomItems((current) => current.filter((item) => item.id !== itemId));
  };

  const saveSession = (feedback: AsadoFeedback) => {
    const nextSession: SavedAsadoSession = {
      id: String(Date.now()),
      date: new Date().toISOString(),
      people: totalPeople,
      cutType,
      scenario,
      temp,
      wind,
      meatKg: results.carneTotal,
      carbonKg: results.carbonTotal,
      costPerPerson,
      feedback,
    };

    const nextHistory = [nextSession, ...history].slice(0, 8);
    setHistory(nextHistory);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
    showNotice('Asado guardado en el historial.');
  };

  const deleteSession = (sessionId: string) => {
    const nextHistory = history.filter((session) => session.id !== sessionId);
    setHistory(nextHistory);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
  };

  const shareDetails = async () => {
    triggerHaptic(30);
    const forecastLine = forecast.bestSlot
      ? `Mejor horario: ${forecast.bestSlot.label} (${forecast.bestSlot.wind} km/h, ráfagas ${forecast.bestSlot.gust} km/h)`
      : 'Pronóstico: pendiente';
    const listText = allChecklist
      .map((item) => `- ${item.label}: ${item.amount}`)
      .join('\n');
    const text = `ASADO PRO - RÍO GALLEGOS
Comensales: ${totalPeople} (${demographics.hombres}H / ${demographics.mujeres}M / ${demographics.ninos}N)
Corte: ${cutType === 'premium' ? 'Premium mix' : cutType === 'con_hueso' ? 'Con hueso' : 'Sin hueso'}
Clima: ${temp}°C, viento ${wind} km/h
${forecastLine}
Factor térmico: ${results.factorFuego}x

Compra:
${listText}

Escote estimado: $${currency.format(costPerPerson)} ARS por persona`;

    if (navigator.share) {
      await navigator.share({ title: 'Asado Pro Río Gallegos', text }).catch(() => undefined);
      return;
    }

    await navigator.clipboard.writeText(text);
    showNotice('Lista copiada para compartir.');
  };

  return (
    <div className="min-h-screen bg-[#120d0b] text-stone-100">
      <header className="sticky top-0 z-10 border-b border-amber-900/30 bg-[#120d0b]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-amber-300">Asado Pro</h1>
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-300/80">
              Río Gallegos · compras, clima, escote e historial
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
                onlineStatus
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
              }`}
            >
              {onlineStatus ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {onlineStatus ? 'En línea' : 'Offline'}
            </span>

            <button
              onClick={fetchForecast}
              disabled={weather.loading || forecast.loading}
              className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-60"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${weather.loading || forecast.loading ? 'animate-spin' : ''}`}
              />
              {weather.loading || forecast.loading ? 'Leyendo clima' : 'Pronóstico'}
            </button>

            {deferredPrompt && (
              <button
                onClick={triggerInstall}
                className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/15 px-3 py-1 text-xs font-bold text-orange-200 transition hover:bg-orange-500/25"
              >
                <Download className="h-3.5 w-3.5" />
                Instalar
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-5 xl:grid-cols-[1fr_1fr]">
        <section className="flex flex-col gap-4">
          <Panel title="Comensales" icon={<Users className="h-5 w-5 text-orange-400" />}>
            <div className="flex items-center justify-between gap-3">
              <IconButton label="Restar persona" onClick={() => updatePeople(totalPeople - 1)}>
                <Minus className="h-4 w-4" />
              </IconButton>
              <div className="text-center">
                <div className="text-5xl font-black text-white">{totalPeople}</div>
                <div className="text-xs font-bold uppercase tracking-wider text-stone-400">personas</div>
              </div>
              <IconButton label="Sumar persona" onClick={() => updatePeople(totalPeople + 1)}>
                <Plus className="h-4 w-4" />
              </IconButton>
            </div>

            <input
              type="range"
              min="1"
              max="80"
              value={totalPeople}
              onChange={(event) => updatePeople(parseInt(event.target.value, 10))}
              className="mt-4 w-full accent-orange-500"
            />

            <button
              onClick={() => setShowAdvancedDemo((value) => !value)}
              className="mt-3 w-full rounded-lg border border-amber-900/70 bg-[#160f0d] px-3 py-2 text-sm font-bold text-amber-200"
            >
              {showAdvancedDemo ? 'Usar reparto automático' : 'Editar hombres, mujeres y niños'}
            </button>

            {showAdvancedDemo && (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <Counter
                  label="Hombres"
                  value={demographics.hombres}
                  onChange={(value) => updateDemographic('hombres', value)}
                />
                <Counter
                  label="Mujeres"
                  value={demographics.mujeres}
                  onChange={(value) => updateDemographic('mujeres', value)}
                />
                <Counter
                  label="Niños"
                  value={demographics.ninos}
                  onChange={(value) => updateDemographic('ninos', value)}
                />
              </div>
            )}
          </Panel>

          <Panel title="Corte y fuego" icon={<Flame className="h-5 w-5 text-red-400" />}>
            <Segmented
              value={cutType}
              options={[
                ['premium', 'Premium mix'],
                ['con_hueso', 'Con hueso'],
                ['sin_hueso', 'Sin hueso'],
              ]}
              onChange={(value) => setCutType(value as CutType)}
            />

            <div className="mt-4">
              <Segmented
                value={scenario}
                options={[
                  ['quincho', 'Quincho'],
                  ['chulengo', 'Chulengo'],
                  ['afuera', 'Intemperie'],
                ]}
                onChange={(value) => setScenario(value as ScenarioType)}
              />
            </div>
          </Panel>

          <Panel title="Bebidas y extras" icon={<ListPlus className="h-5 w-5 text-emerald-300" />}>
            <div className="grid gap-2 sm:grid-cols-3">
              <ToggleButton
                active={extrasConfig.includeAlcohol}
                label="Con alcohol"
                onClick={() =>
                  setExtrasConfig((current) => ({
                    ...current,
                    includeAlcohol: !current.includeAlcohol,
                  }))
                }
              />
              <ToggleButton
                active={extrasConfig.saladMode === 'abundante'}
                label="Ensalada fuerte"
                onClick={() =>
                  setExtrasConfig((current) => ({
                    ...current,
                    saladMode: current.saladMode === 'abundante' ? 'simple' : 'abundante',
                  }))
                }
              />
              <ToggleButton
                active={extrasConfig.breadMode === 'generoso'}
                label="Pan generoso"
                onClick={() =>
                  setExtrasConfig((current) => ({
                    ...current,
                    breadMode: current.breadMode === 'generoso' ? 'normal' : 'generoso',
                  }))
                }
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Agua" value={`${extras.waterLiters} l`} detail="base" compact />
              <Metric label="Gaseosa" value={`${extras.sodaLiters} l`} detail="jugo/soda" compact />
              <Metric label="Hielo" value={`${extras.iceKg} kg`} detail="conservadora" compact />
              <Metric
                label="Alcohol"
                value={extrasConfig.includeAlcohol ? `${extras.beerLiters} l` : '0 l'}
                detail={extrasConfig.includeAlcohol ? `${extras.wineBottles} vinos` : 'sin alcohol'}
                compact
              />
            </div>
          </Panel>

          <Panel title="Clima local" icon={<Wind className="h-5 w-5 text-sky-300" />}>
            <Slider
              label="Temperatura"
              value={temp}
              min={-10}
              max={35}
              unit="°C"
              onChange={setTemp}
              icon={<Thermometer className="h-4 w-4 text-sky-300" />}
            />
            <Slider
              label="Viento"
              value={wind}
              min={0}
              max={110}
              unit="km/h"
              onChange={setWind}
              icon={<Wind className="h-4 w-4 text-orange-300" />}
            />

            <div className={`mt-3 rounded-lg border p-3 text-sm font-bold ${adviceStatus.color}`}>
              {adviceStatus.message}
            </div>

            {weather.isReal && (
              <p className="mt-2 text-xs text-sky-300">
                {weather.locationName}: {weather.conditionText}, {weather.temp}°C, viento{' '}
                {weather.wind} km/h.
              </p>
            )}
            {weather.error && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-rose-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                {weather.error}
              </p>
            )}
          </Panel>

          <ForecastPanel forecast={forecast} onRefresh={fetchForecast} />
        </section>

        <section className="flex flex-col gap-4">
          <Panel title="Resultado" icon={<Flame className="h-5 w-5 text-orange-400" />}>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Carne" value={`${results.carneTotal} kg`} detail="principal" />
              <Metric label="Chorizos" value={`${results.choriTotal}`} detail="unidades" />
              <Metric
                label="Carbón"
                value={`${results.carbonTotal} kg`}
                detail={`${results.bolsasCarbon} bolsas`}
              />
              <Metric
                label="Leña"
                value={`${results.lenaTotal} kg`}
                detail={`${results.bolsasLena} atados`}
              />
            </div>

            <div className="mt-4 rounded-lg border border-amber-900/50 bg-[#150d0b] p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  Factor térmico
                </span>
                <span className="font-mono text-lg font-black text-orange-300">
                  {results.factorFuego}x
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-stone-300">{thermoTips.climateSummary}</p>
            </div>
          </Panel>

          <Panel title="Lista editable" icon={<Check className="h-5 w-5 text-emerald-300" />}>
            <div className="mb-3 h-2 overflow-hidden rounded-full bg-[#100907]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 to-emerald-400"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_0.75fr_0.7fr_auto]">
              <input
                value={customLabel}
                onChange={(event) => setCustomLabel(event.target.value)}
                placeholder="Agregar item"
                className="min-h-10 rounded-lg border border-amber-900/70 bg-[#100907] px-3 text-sm font-semibold text-stone-100 outline-none focus:border-orange-500"
              />
              <input
                value={customAmount}
                onChange={(event) => setCustomAmount(event.target.value)}
                placeholder="Cantidad"
                className="min-h-10 rounded-lg border border-amber-900/70 bg-[#100907] px-3 text-sm font-semibold text-stone-100 outline-none focus:border-orange-500"
              />
              <select
                value={customCategory}
                onChange={(event) => setCustomCategory(event.target.value as ChecklistCategory)}
                className="min-h-10 rounded-lg border border-amber-900/70 bg-[#100907] px-3 text-sm font-semibold text-stone-100 outline-none focus:border-orange-500"
              >
                <option value="carnes">Carnes</option>
                <option value="fuego">Fuego</option>
                <option value="bebidas">Bebidas</option>
                <option value="acompanamientos">Acomp.</option>
                <option value="otros">Otros</option>
              </select>
              <button
                onClick={addCustomItem}
                className="grid min-h-10 place-items-center rounded-lg bg-orange-600 px-3 text-white transition hover:bg-orange-500"
                aria-label="Agregar item"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
              {allChecklist.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between gap-3 rounded-lg border p-3 transition ${
                    item.checked
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-stone-400'
                      : 'border-amber-900/60 bg-[#150d0b] text-stone-100 hover:border-amber-700'
                  }`}
                >
                  <button
                    onClick={() => toggleChecklistItem(item)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-bold"
                  >
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${
                        item.checked ? 'border-emerald-400 bg-emerald-500 text-white' : 'border-amber-800'
                      }`}
                    >
                      {item.checked && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate">{item.label}</span>
                      <span className="text-[11px] uppercase tracking-wider text-stone-500">
                        {categoryLabel(item.category)}
                      </span>
                    </span>
                  </button>
                  <span className="shrink-0 text-xs font-black text-orange-300">{item.amount}</span>
                  {item.custom && (
                    <button
                      onClick={() => removeCustomItem(item.id)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-rose-500/30 text-rose-300"
                      aria-label={`Quitar ${item.label}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Escote" icon={<DollarSign className="h-5 w-5 text-emerald-300" />}>
            <Slider
              label="Precio carne"
              value={costs.meatPricePerKg}
              min={9000}
              max={200000}
              step={1000}
              unit="ARS/kg"
              onChange={(value) => setCosts((current) => ({ ...current, meatPricePerKg: value }))}
            />
            <Slider
              label="Extras"
              value={costs.extraExpenses}
              min={0}
              max={600000}
              step={10000}
              unit="ARS"
              onChange={(value) => setCosts((current) => ({ ...current, extraExpenses: value }))}
            />

            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                    Total estimado
                  </div>
                  <div className="text-xl font-black">${currency.format(totalCostEstimate)} ARS</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold uppercase tracking-wider text-orange-300">
                    Por cabeza
                  </div>
                  <div className="text-2xl font-black text-orange-300">
                    ${currency.format(costPerPerson)}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={shareDetails}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-3 text-sm font-black text-white transition hover:bg-orange-500"
            >
              <Share2 className="h-4 w-4" />
              Compartir lista
            </button>
          </Panel>

          <HistoryPanel
            history={history}
            adjustment={feedbackAdjustment}
            onSave={saveSession}
            onDelete={deleteSession}
          />
        </section>
      </main>

      {notice && (
        <div className="fixed bottom-4 left-1/2 z-20 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg border border-emerald-500/30 bg-emerald-950 px-4 py-3 text-center text-sm font-bold text-emerald-100 shadow-xl">
          {notice}
        </div>
      )}

      <footer className="px-4 pb-8 text-center text-xs text-stone-500">
        Asado Pro Río Gallegos · Optimizado para Android y uso offline
      </footer>
    </div>
  );
}

function ForecastPanel({
  forecast,
  onRefresh,
}: {
  forecast: ForecastState;
  onRefresh: () => void;
}) {
  return (
    <Panel title="Pronóstico de parrilla" icon={<CloudSun className="h-5 w-5 text-sky-300" />}>
      {forecast.bestSlot ? (
        <div className={`rounded-lg border p-3 ${forecastTone(forecast.bestSlot.status)}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider opacity-80">Mejor horario</div>
              <div className="text-xl font-black">{forecast.bestSlot.label}</div>
            </div>
            <div className="text-right font-mono text-2xl font-black">{forecast.bestSlot.score}</div>
          </div>
          <p className="mt-2 text-sm font-semibold">{forecast.bestSlot.reason}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-sm font-bold text-sky-200">
          Consultá Open-Meteo para elegir la mejor ventana de fuego de las próximas 72 horas.
        </div>
      )}

      {forecast.error && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-rose-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          {forecast.error}
        </p>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {forecast.slots.map((slot) => (
          <div key={slot.time} className="rounded-lg border border-amber-900/50 bg-[#150d0b] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-black text-amber-100">
                <Clock className="h-3.5 w-3.5 text-orange-300" />
                {slot.label}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${slotBadge(slot.status)}`}>
                {slot.status}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-stone-300">
              <span>{slot.temp}°C</span>
              <span>{slot.wind} km/h</span>
              <span>ráf. {slot.gust}</span>
            </div>
            <div className="mt-1 text-xs text-sky-300">lluvia {slot.precipitationProbability}%</div>
          </div>
        ))}
      </div>

      <button
        onClick={onRefresh}
        disabled={forecast.loading}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm font-black text-sky-200 transition hover:bg-sky-500/20 disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${forecast.loading ? 'animate-spin' : ''}`} />
        Actualizar pronóstico
      </button>
    </Panel>
  );
}

function HistoryPanel({
  history,
  adjustment,
  onSave,
  onDelete,
}: {
  history: SavedAsadoSession[];
  adjustment: { title: string; message: string; tone: string };
  onSave: (feedback: AsadoFeedback) => void;
  onDelete: (sessionId: string) => void;
}) {
  return (
    <Panel title="Historial y ajuste" icon={<History className="h-5 w-5 text-orange-300" />}>
      <div className={`rounded-lg border p-3 ${adjustment.tone}`}>
        <div className="text-sm font-black">{adjustment.title}</div>
        <p className="mt-1 text-xs leading-relaxed">{adjustment.message}</p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <FeedbackButton label="Perfecto" tone="emerald" onClick={() => onSave('perfecto')} />
        <FeedbackButton label="Sobró" tone="sky" onClick={() => onSave('sobro')} />
        <FeedbackButton label="Faltó" tone="amber" onClick={() => onSave('falto')} />
      </div>

      <div className="mt-3 space-y-2">
        {history.length === 0 && (
          <div className="rounded-lg border border-amber-900/50 bg-[#150d0b] p-3 text-sm text-stone-400">
            Guardá el resultado real de cada asado para calibrar futuras compras.
          </div>
        )}

        {history.map((session) => (
          <div
            key={session.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-amber-900/50 bg-[#150d0b] p-3"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-black text-amber-100">
                {new Intl.DateTimeFormat('es-AR', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(session.date))}
                {' · '}
                {feedbackLabel(session.feedback)}
              </div>
              <div className="text-xs text-stone-400">
                {session.people} pers · {session.meatKg} kg carne · ${currency.format(session.costPerPerson)}
              </div>
            </div>
            <button
              onClick={() => onDelete(session.id)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-rose-500/30 text-rose-300"
              aria-label="Borrar asado guardado"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-amber-900/35 bg-[#1a110f] p-4 shadow-xl">
      <div className="mb-4 flex items-center gap-2 border-b border-amber-900/25 pb-3">
        {icon}
        <h2 className="text-sm font-black uppercase tracking-wider text-amber-100">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="grid h-10 w-10 place-items-center rounded-lg border border-amber-900 bg-[#1c120f] text-amber-200"
      aria-label={label}
    >
      {children}
    </button>
  );
}

function Counter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-lg border border-amber-900/50 bg-[#150d0b] p-3">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-400">{label}</div>
      <div className="flex items-center justify-between gap-2">
        <IconButton label={`Restar ${label}`} onClick={() => onChange(value - 1)}>
          <Minus className="h-3.5 w-3.5" />
        </IconButton>
        <span className="text-xl font-black">{value}</span>
        <IconButton label={`Sumar ${label}`} onClick={() => onChange(value + 1)}>
          <Plus className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </div>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {options.map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`rounded-lg border px-3 py-3 text-sm font-black transition ${
            value === key
              ? 'border-orange-500 bg-orange-500/15 text-orange-200'
              : 'border-amber-900/70 bg-[#150d0b] text-stone-400 hover:border-amber-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ToggleButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-3 text-sm font-black transition ${
        active
          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200'
          : 'border-amber-900/70 bg-[#150d0b] text-stone-400 hover:border-amber-700'
      }`}
    >
      {label}
    </button>
  );
}

function FeedbackButton({
  label,
  tone,
  onClick,
}: {
  label: string;
  tone: 'emerald' | 'sky' | 'amber';
  onClick: () => void;
}) {
  const tones = {
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    sky: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  };

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-3 text-sm font-black ${tones[tone]}`}
    >
      <Save className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  icon,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  icon?: ReactNode;
  onChange: (value: number) => void;
}) {
  return (
    <label className="mt-3 block">
      <span className="mb-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-400">
          {icon}
          {label}
        </span>
        <span className="font-mono text-sm font-black text-orange-300">
          {currency.format(value)} {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(parseInt(event.target.value, 10))}
        className="w-full accent-orange-500"
      />
    </label>
  );
}

function Metric({
  label,
  value,
  detail,
  compact = false,
}: {
  label: string;
  value: string;
  detail: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-lg border border-amber-900/50 bg-[#150d0b] p-4">
      <div className="text-xs font-bold uppercase tracking-wider text-stone-400">{label}</div>
      <div className={`mt-1 font-black text-orange-300 ${compact ? 'text-xl' : 'text-2xl'}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-stone-500">{detail}</div>
    </div>
  );
}

function describeWeatherCode(code?: number) {
  if (code === undefined) return 'Condición actual';
  if ([0, 1].includes(code)) return 'Despejado';
  if ([2, 3].includes(code)) return 'Nubosidad variable';
  if ([45, 48].includes(code)) return 'Niebla';
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return 'Lluvia';
  if ([71, 73, 75, 85, 86].includes(code)) return 'Nieve';
  if ([95, 96, 99].includes(code)) return 'Tormenta';
  return 'Condición actual';
}

function categoryLabel(category: ChecklistCategory) {
  const labels: Record<ChecklistCategory, string> = {
    carnes: 'Carnes',
    fuego: 'Fuego',
    bebidas: 'Bebidas',
    acompanamientos: 'Acompañamientos',
    otros: 'Otros',
  };
  return labels[category];
}

function feedbackLabel(feedback: AsadoFeedback) {
  const labels: Record<AsadoFeedback, string> = {
    perfecto: 'perfecto',
    sobro: 'sobró',
    falto: 'faltó',
  };
  return labels[feedback];
}

function forecastTone(status: 'ideal' | 'usable' | 'riesgoso') {
  const tones = {
    ideal: 'text-emerald-200 border-emerald-500/30 bg-emerald-500/10',
    usable: 'text-amber-200 border-amber-500/30 bg-amber-500/10',
    riesgoso: 'text-rose-200 border-rose-500/30 bg-rose-500/10',
  };
  return tones[status];
}

function slotBadge(status: 'ideal' | 'usable' | 'riesgoso') {
  const tones = {
    ideal: 'bg-emerald-500/15 text-emerald-200',
    usable: 'bg-amber-500/15 text-amber-200',
    riesgoso: 'bg-rose-500/15 text-rose-200',
  };
  return tones[status];
}
