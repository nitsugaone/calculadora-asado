import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  DollarSign,
  Download,
  Flame,
  Minus,
  Plus,
  RefreshCw,
  Share2,
  Smartphone,
  Thermometer,
  Users,
  Wifi,
  WifiOff,
  Wind,
} from 'lucide-react';
import { calculateAsado, getThermodynamicAdvice, getWeatherAdvice } from './calculations';
import {
  ChecklistItem,
  CutType,
  ParticipantConfig,
  ScenarioType,
  SplitCostConfig,
  WeatherStatus,
} from './types';

const DEFAULT_MEAT_PRICE = 10000;
const DEFAULT_COAL_PRICE = 2200;
const DEFAULT_EXTRA_PRICE = 15000;

const currency = new Intl.NumberFormat('es-AR');

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
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [onlineStatus, setOnlineStatus] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [weather, setWeather] = useState<WeatherStatus>({
    temp: 8,
    wind: 35,
    loading: false,
    isReal: false,
    locationName: 'Río Gallegos (promedio)',
    conditionText: 'Clima ventoso de referencia',
    error: null,
  });
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

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    };
  }, []);

  const results = calculateAsado(
    totalPeople,
    cutType,
    scenario,
    temp,
    wind,
    showAdvancedDemo ? demographics : null
  );

  const adviceStatus = getWeatherAdvice(scenario, temp, wind);
  const thermoTips = getThermodynamicAdvice(temp, wind);

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
        label: 'Bebidas',
        amount: `${Math.ceil(totalPeople * 0.6)} litros base`,
        category: 'bebidas',
        checked: false,
      },
      {
        id: 'a1',
        label: 'Pan y ensaladas',
        amount: `Para ${totalPeople} personas`,
        category: 'acompanamientos',
        checked: false,
      },
      {
        id: 'a2',
        label: 'Chimichurri y salsa criolla',
        amount: '1 frasco de cada uno',
        category: 'acompanamientos',
        checked: false,
      },
    ],
    [cutType, results, totalPeople]
  );

  useEffect(() => {
    setChecklist((previous) =>
      checklistItems.map((item) => ({
        ...item,
        checked: previous.find((prior) => prior.id === item.id)?.checked ?? false,
      }))
    );
  }, [checklistItems]);

  const checkedCount = checklist.filter((item) => item.checked).length;
  const progressPercent =
    checklist.length === 0 ? 0 : Math.round((checkedCount / checklist.length) * 100);

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

  const fetchRealWeather = async () => {
    triggerHaptic(20);
    setWeather((previous) => ({ ...previous, loading: true, error: null }));

    try {
      const response = await fetch('https://wttr.in/Rio%20Gallegos?format=j1');
      if (!response.ok) {
        throw new Error('No se pudo consultar el clima.');
      }

      const data = await response.json();
      const current = data.current_condition?.[0];
      if (!current) {
        throw new Error('La respuesta del clima no tiene datos actuales.');
      }

      const nextTemp = parseInt(current.temp_C, 10) || 8;
      const nextWind = parseInt(current.windspeedKmph, 10) || 35;
      const condition =
        current.lang_es?.[0]?.value || current.weatherDesc?.[0]?.value || 'Parcialmente nublado';

      setWeather({
        temp: nextTemp,
        wind: nextWind,
        loading: false,
        isReal: true,
        locationName: 'Río Gallegos',
        conditionText: condition,
        error: null,
      });
      setTemp(nextTemp);
      setWind(nextWind);
      showNotice('Clima real actualizado.');
    } catch {
      setWeather((previous) => ({
        ...previous,
        loading: false,
        isReal: false,
        error: 'No se pudo conectar al clima real. Se mantienen valores manuales.',
      }));
    }
  };

  const triggerInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const shareDetails = async () => {
    triggerHaptic(30);
    const text = `ASADO PRO - RÍO GALLEGOS
Comensales: ${totalPeople} (${demographics.hombres}H / ${demographics.mujeres}M / ${demographics.ninos}N)
Corte: ${cutType === 'premium' ? 'Premium mix' : cutType === 'con_hueso' ? 'Con hueso' : 'Sin hueso'}
Clima: ${temp}°C, viento ${wind} km/h
Factor térmico: ${results.factorFuego}x

Compra:
- Carne: ${results.carneTotal} kg
- Chorizos: ${results.choriTotal}
- Morcillas: ${results.morciTotal}
- Carbón: ${results.carbonTotal} kg (${results.bolsasCarbon} bolsas)
- Leña: ${results.lenaTotal} kg (${results.bolsasLena} atados)

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
              Río Gallegos · calculadora de fuego, compras y escote
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
              onClick={fetchRealWeather}
              disabled={weather.loading}
              className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${weather.loading ? 'animate-spin' : ''}`} />
              {weather.loading ? 'Leyendo clima' : 'Clima real'}
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

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-5 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="flex flex-col gap-4">
          <Panel title="Comensales" icon={<Users className="h-5 w-5 text-orange-400" />}>
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => updatePeople(totalPeople - 1)}
                className="grid h-10 w-10 place-items-center rounded-lg border border-amber-900 bg-[#1c120f] text-amber-200"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="text-center">
                <div className="text-5xl font-black text-white">{totalPeople}</div>
                <div className="text-xs font-bold uppercase tracking-wider text-stone-400">personas</div>
              </div>
              <button
                onClick={() => updatePeople(totalPeople + 1)}
                className="grid h-10 w-10 place-items-center rounded-lg border border-amber-900 bg-[#1c120f] text-amber-200"
              >
                <Plus className="h-4 w-4" />
              </button>
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

          <Panel title="Lista de compras" icon={<Check className="h-5 w-5 text-emerald-300" />}>
            <div className="mb-3 h-2 overflow-hidden rounded-full bg-[#100907]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 to-emerald-400"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {checklist.map((item) => (
                <button
                  key={item.id}
                  onClick={() =>
                    setChecklist((current) =>
                      current.map((entry) =>
                        entry.id === item.id ? { ...entry, checked: !entry.checked } : entry
                      )
                    )
                  }
                  className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition ${
                    item.checked
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-stone-400'
                      : 'border-amber-900/60 bg-[#150d0b] text-stone-100 hover:border-amber-700'
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <span
                      className={`grid h-5 w-5 place-items-center rounded border ${
                        item.checked ? 'border-emerald-400 bg-emerald-500 text-white' : 'border-amber-800'
                      }`}
                    >
                      {item.checked && <Check className="h-3.5 w-3.5" />}
                    </span>
                    {item.label}
                  </span>
                  <span className="text-xs font-black text-orange-300">{item.amount}</span>
                </button>
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
        <button
          onClick={() => onChange(value - 1)}
          className="grid h-8 w-8 place-items-center rounded border border-amber-900 text-amber-200"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="text-xl font-black">{value}</span>
        <button
          onClick={() => onChange(value + 1)}
          className="grid h-8 w-8 place-items-center rounded border border-amber-900 text-amber-200"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
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

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-amber-900/50 bg-[#150d0b] p-4">
      <div className="text-xs font-bold uppercase tracking-wider text-stone-400">{label}</div>
      <div className="mt-1 text-2xl font-black text-orange-300">{value}</div>
      <div className="mt-1 text-xs text-stone-500">{detail}</div>
    </div>
  );
}
