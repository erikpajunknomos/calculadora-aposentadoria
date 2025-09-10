import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* =========================
   Utils
========================= */

const BRL0 = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const BRL2 = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

function formatCurrency(n: number, withCents = false) {
  if (!isFinite(n)) return withCents ? "R$ 0,00" : "R$ 0";
  return (withCents ? BRL2 : BRL0).format(Math.round(n));
}

function formatNumber(n: number, d = 1) {
  if (!isFinite(n)) return "0";
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}

function parseMoneyInput(v: string) {
  // aceita só dígitos, interpreta como inteiro BRL
  const digits = v.replace(/\D+/g, "");
  if (!digits) return 0;
  return parseInt(digits, 10);
}

function asPct(n: number) {
  return `${formatNumber(n, 0)}%`;
}

/* =========================
   Types
========================= */
type Lump = { id: number; month: number; amount: number };

/* =========================
   Component
========================= */

export default function App() {
  /* --------- Defaults --------- */
  const [age, setAge] = useState(24);
  const [retireAge, setRetireAge] = useState(34);

  const [wealth, setWealth] = useState(3_000_000); // patrimônio atual
  const [monthlySaving, setMonthlySaving] = useState(120_000);
  const [monthlySpend, setMonthlySpend] = useState(100_000); // gasto na aposentadoria

  const [swrPct, setSwrPct] = useState(3.5); // SWR % a.a.
  const [accRealReturn, setAccRealReturn] = useState(5); // retorno real na acumulação (% a.a.)
  const [retireRealReturn, setRetireRealReturn] = useState(3.5); // retorno real na aposentadoria (% a.a.)

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Aportes pontuais (valor e mês em que entra)
  const [lumps, setLumps] = useState<Lump[]>([
    { id: 1, month: 12, amount: 5_000_000 },
  ]);

  // Avançado OFF => retorno na aposentadoria acompanha o SWR
  useEffect(() => {
    if (!showAdvanced) setRetireRealReturn(swrPct);
  }, [swrPct, showAdvanced]);

  /* --------- Cálculos centrais --------- */

  const monthsToRetire = Math.max(0, (retireAge - age) * 12);
  const monthsTo100 = Math.max(0, (100 - age) * 12);

  const rAcc = Math.pow(1 + accRealReturn / 100, 1 / 12) - 1; // retorno mensal real
  const rRet = Math.pow(1 + retireRealReturn / 100, 1 / 12) - 1;

  // Número mágico (meta) para o gasto mensal informado com SWR
  const magicNumber = useMemo(() => {
    if (swrPct <= 0) return Infinity;
    return (monthlySpend * 12) / (swrPct / 100);
  }, [monthlySpend, swrPct]);

  // Projeção mensal até a aposentadoria e até 100 anos (para gráfico)
  const { wealthAtRetire, series, retireIndex } = useMemo(() => {
    let cur = wealth;
    const lumpsMap = new Map<number, number>();
    for (const l of lumps) {
      if (l.month > 0) {
        lumpsMap.set(l.month, (lumpsMap.get(l.month) ?? 0) + Math.max(0, l.amount));
      }
    }

    const arr: { x: number; age: number; wealth: number; goal: number }[] = [];
    for (let m = 0; m <= monthsTo100; m++) {
      // aportes mensais durante a acumulação (até aposentadoria)
      if (m <= monthsToRetire) {
        if (m > 0) cur *= 1 + rAcc;
        cur += monthlySaving;
        if (lumpsMap.has(m)) cur += lumpsMap.get(m)!;
      } else {
        // após a aposentadoria, só renda de investimento (mantemos para visualizar o saldo se não houver saque)
        cur *= 1 + rAcc; // pequena suposição: seguimos aplicando o mesmo retorno de acumulação para a trajetória do gráfico
      }
      arr.push({
        x: m,
        age: age + m / 12,
        wealth: Math.max(0, cur),
        goal: magicNumber,
      });
    }

    // wealth exatamente no mês da aposentadoria (após aplicar rAcc + aporte mensal + lumps do próprio mês)
    const wAtRetire =
      monthsToRetire >= 0 && monthsToRetire < arr.length
        ? arr[monthsToRetire].wealth
        : wealth;

    return { wealthAtRetire: wAtRetire, series: arr, retireIndex: monthsToRetire };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wealth, monthlySaving, lumps, monthsTo100, monthsToRetire, rAcc, age, magicNumber]);

  // Gasto sustentável pela regra do SWR no momento da aposentadoria (sem consumir principal)
  const sustainableMonthlySWR = useMemo(() => {
    return (wealthAtRetire * (swrPct / 100)) / 12;
  }, [wealthAtRetire, swrPct]);

  // Cobertura (anos) se gastar monthlySpend com retorno real na aposentadoria rRet
  const { runwayYears, hasPerpetuity, endAge } = useMemo(() => {
    const C = monthlySpend;
    const PV = wealthAtRetire;
    const r = rRet;

    if (C <= 0) return { runwayYears: Infinity, hasPerpetuity: true, endAge: Infinity };
    if (PV <= 0) return { runwayYears: 0, hasPerpetuity: false, endAge: age };

    // Se o saque mensal for <= juros mensal * PV, é “perpétuo” (não consome principal).
    if (PV * r >= C) {
      return { runwayYears: Infinity, hasPerpetuity: true, endAge: Infinity };
    }

    // N = - ln(1 - PV*r/PMT) / ln(1+r)
    const N = -Math.log(1 - (PV * r) / C) / Math.log(1 + r);
    const years = N / 12;
    return {
      runwayYears: years,
      hasPerpetuity: false,
      endAge: age + (monthsToRetire + N) / 12,
    };
  }, [monthlySpend, wealthAtRetire, rRet, age, monthsToRetire]);

  // Progresso rumo ao número mágico
  const progressPct = useMemo(() => {
    if (magicNumber <= 0 || !isFinite(magicNumber)) return 100;
    const p = (wealthAtRetire / magicNumber) * 100;
    return clamp(p, 0, 100);
  }, [wealthAtRetire, magicNumber]);

  const remainingToGoal =
    magicNumber > wealthAtRetire ? magicNumber - wealthAtRetire : 0;

  // Poupança extra necessária por mês para alcançar a meta no horizonte (retireAge)
  const extraMonthlyToHitTarget = useMemo(() => {
    const n = monthsToRetire;
    if (n <= 0) return 0;
    const r = rAcc;

    // FV dos itens que já temos:
    const FV_wealth = wealth * Math.pow(1 + r, n);

    const FV_existingMonthly =
      monthlySaving * ((Math.pow(1 + r, n) - 1) / r);

    // lumps (no mês l.month, cresce até n)
    const FV_lumps = lumps.reduce((acc, l) => {
      if (l.month <= 0 || l.month > n) return acc;
      return acc + l.amount * Math.pow(1 + r, n - l.month);
    }, 0);

    const needed = magicNumber - (FV_wealth + FV_existingMonthly + FV_lumps);
    if (needed <= 0) return 0;

    // quanto a mais por mês é necessário:
    const factor = (Math.pow(1 + r, n) - 1) / r;
    return Math.max(0, needed / factor);
  }, [monthsToRetire, rAcc, wealth, monthlySaving, lumps, magicNumber]);

  // Em quanto tempo bate a meta (simulando mês a mês com as premissas atuais)
  const { monthsToGoal, ageAtGoal } = useMemo(() => {
    const MAX = 2000; // ~166 anos (um cap para evitar loop infinito)
    let cur = wealth;
    let m = 0;
    const lumpsMap = new Map<number, number>();
    for (const l of lumps) {
      if (l.month > 0) lumpsMap.set(l.month, (lumpsMap.get(l.month) ?? 0) + l.amount);
    }
    while (m < MAX && cur < magicNumber) {
      m++;
      cur = cur * (1 + rAcc) + monthlySaving + (lumpsMap.get(m) ?? 0);
    }
    return {
      monthsToGoal: cur >= magicNumber ? m : Infinity,
      ageAtGoal:
        cur >= magicNumber ? age + m / 12 : Infinity,
    };
  }, [wealth, monthlySaving, lumps, rAcc, magicNumber, age]);

  /* --------- UI helpers --------- */

  function rangeBg(pct: number) {
    // barra preenchida em verde até pct
    return {
      background: `linear-gradient(90deg, var(--brand-dark) ${pct}%, #e5e7eb ${pct}%)`,
      height: 8,
      borderRadius: 9999,
      appearance: "none" as const,
    };
  }

  const brand = {
    dark: "#082e1f",
    mid: "#0b4731",
    light: "#e9f6ee",
    sand: "#efe7dd",
    accent: "#f8f5e6",
    badge: "#eef2f6",
    warn: "#fdecc8",
  };

  /* --------- Inputs (controles) --------- */

  const addLump = () =>
    setLumps((s) => [...s, { id: Date.now(), month: 1, amount: 10_000 }]);

  const removeLastLump = () =>
    setLumps((s) => (s.length ? s.slice(0, -1) : s));

  /* --------- Gráfico --------- */

  const tickAges = useMemo(() => {
    // de idade atual a 100 anos, ~8-10 marcas
    const start = Math.ceil(age);
    const end = 100;
    const step = Math.max(3, Math.round((end - start) / 8));
    const values: number[] = [];
    for (let a = start; a <= end; a += step) values.push(a);
    if (values[values.length - 1] !== 100) values.push(100);
    return values;
  }, [age]);

  const tooltipFormatter = (value: any, name: any) => {
    if (name === "Meta de aposentadoria (SWR)") {
      return [formatCurrency(Number(value)), "Meta (SWR)"];
    }
    return [formatCurrency(Number(value)), "Patrimônio projetado (real)"];
  };

  /* =========================
     Render
  ========================= */

  return (
    <div className="min-h-screen bg-[var(--sand)] text-slate-900"
      style={
        {
          // css variables
          ["--brand-dark" as any]: brand.dark,
          ["--brand-mid" as any]: brand.mid,
          ["--brand-light" as any]: brand.light,
          ["--sand" as any]: brand.sand,
          ["--accent" as any]: brand.accent,
        } as React.CSSProperties
      }
    >
      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 pt-4 pb-2">
        <div className="flex items-center gap-3 mb-4">
          <span className="rounded-xl bg-[var(--brand-dark)] text-[#c9ff79] px-3 py-2 text-sm font-semibold">
            Nomos Sports
          </span>
          <a
            className="ml-auto inline-flex rounded-xl px-4 py-2 text-white font-semibold"
            style={{ background: brand.mid }}
            href="https://api.whatsapp.com/send?phone=5521986243416&text=Ol%C3%A1%21+Estava+mexendo+na+calculadora+de+aposentadoria+da+Nomos+Sports.+Podemos+bater+um+papo%3F"
            target="_blank"
            rel="noreferrer"
          >
            Falar com um especialista no WhatsApp
          </a>
        </div>

        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-[var(--brand-dark)]">
          Calculadora de Aposentadoria para Atletas
        </h1>
      </div>

      {/* Top KPI: Número mágico & Progresso */}
      <div className="max-w-6xl mx-auto px-4 mt-4 grid grid-cols-1 gap-4">
        <div className="rounded-2xl bg-white border shadow-sm p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div>
              <div className="text-slate-600 text-sm">Número mágico (SWR)</div>
              <div className="text-[clamp(1.6rem,3.5vw,3rem)] font-extrabold text-[var(--brand-dark)] leading-tight">
                {formatCurrency(magicNumber)}
              </div>
              <div className="text-slate-700 text-sm">
                {formatNumber(swrPct, 1)}% a.a. com gasto de{" "}
                {formatCurrency(monthlySpend)}/mês
              </div>
            </div>

            <div className="min-w-0">
              <div className="text-slate-700 text-sm mb-1">
                Progresso rumo ao número mágico
              </div>
              <div className="flex items-center gap-3">
                <div className="text-2xl font-bold">{asPct(progressPct)}</div>
                <div className="flex-1 h-3 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${progressPct}%`, background: brand.dark }}
                  />
                </div>
              </div>
              <div className="mt-2 inline-flex items-center rounded-full border px-3 py-1 text-sm bg-[var(--warn)] text-slate-800">
                {remainingToGoal > 0
                  ? `Faltam ${formatCurrency(remainingToGoal)} para o número mágico`
                  : `Você superou a meta em ${formatCurrency(
                      wealthAtRetire - magicNumber
                    )}`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body: parâmetros + três cards */}
      <div className="max-w-6xl mx-auto px-4 mt-4 grid grid-cols-1 md:grid-cols-[360px,1fr] gap-4">
        {/* Parâmetros */}
        <div className="rounded-2xl bg-white border shadow-sm p-5">
          <h2 className="text-2xl font-bold mb-4">Parâmetros</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Idade atual"
              value={age}
              onChange={(v) => setAge(clamp(v, 15, 90))}
            />
            <Field
              label="Idade de aposentadoria"
              value={retireAge}
              onChange={(v) => setRetireAge(clamp(v, age + 1, 80))}
            />

            <MoneyField
              label="Patrimônio atual (BRL)"
              value={wealth}
              onChange={setWealth}
            />
            <MoneyField
              label="Poupança mensal (BRL)"
              value={monthlySaving}
              onChange={setMonthlySaving}
            />

            <MoneyField
              label="Gasto mensal na aposentadoria (BRL)"
              value={monthlySpend}
              onChange={setMonthlySpend}
            />
          </div>

          {/* Aportes pontuais */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-lg font-semibold">
                Contribuições pontuais (valor e mês)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addLump}
                  className="rounded-lg border px-3 py-1 hover:bg-gray-50"
                >
                  +
                </button>
                <button
                  onClick={removeLastLump}
                  className="rounded-lg border px-3 py-1 hover:bg-gray-50"
                >
                  –
                </button>
              </div>
            </div>

            {lumps.length === 0 && (
              <div className="text-sm text-slate-600">
                Nenhum aporte único adicionado.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
              {lumps.map((l) => (
                <div
                  key={l.id}
                  className="rounded-xl border p-3 bg-white sm:col-span-7 grid grid-cols-1 sm:grid-cols-10 gap-3"
                >
                  <div className="sm:col-span-7">
                    <SmallLabel>Valor (BRL)</SmallLabel>
                    <MoneyInput
                      value={l.amount}
                      onChange={(v) =>
                        setLumps((s) =>
                          s.map((x) => (x.id === l.id ? { ...x, amount: v } : x))
                        )
                      }
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <SmallLabel className="whitespace-nowrap">
                      Mês em que entra
                    </SmallLabel>
                    <NumberInput
                      value={l.month}
                      min={1}
                      max={monthsToRetire}
                      onChange={(v) =>
                        setLumps((s) =>
                          s.map((x) => (x.id === l.id ? { ...x, month: v } : x))
                        )
                      }
                    />
                    <div className="text-[11px] text-slate-500 mt-1">
                      (1 = próximo mês … até {monthsToRetire})
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SWR + retornos */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border p-4 bg-white">
              <div className="text-sm font-medium text-slate-800">
                SWR — Taxa segura de retirada (% a.a.)
              </div>
              <input
                type="range"
                min={2}
                max={6}
                step={0.1}
                value={swrPct}
                onChange={(e) => setSwrPct(parseFloat(e.target.value))}
                className="w-full mt-2"
                style={rangeBg(((swrPct - 2) / (6 - 2)) * 100)}
              />
              <div className="text-xs text-slate-600 mt-2">
                Atual: {formatNumber(swrPct, 1)}% • 3,5% é um nível histórico/realista;
                acima de 5% tende a ser mais agressivo.
              </div>

              <div className="flex items-center gap-2 mt-3">
                <input
                  id="adv"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={showAdvanced}
                  onChange={(e) => setShowAdvanced(e.target.checked)}
                />
                <label htmlFor="adv" className="text-sm">
                  Mostrar avançado
                </label>
              </div>
            </div>

            <div className="rounded-xl border p-4 bg-white">
              <div className="text-sm font-medium text-slate-800">
                Retorno real na acumulação (% a.a.)
              </div>
              <NumberInput
                value={accRealReturn}
                min={0}
                max={15}
                step={0.1}
                onChange={setAccRealReturn}
              />

              {showAdvanced && (
                <div className="mt-3">
                  <div className="text-sm font-medium text-slate-800">
                    Retorno real na aposentadoria (% a.a.)
                  </div>
                  <NumberInput
                    value={retireRealReturn}
                    min={0}
                    max={15}
                    step={0.1}
                    onChange={setRetireRealReturn}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cards à direita */}
        <div className="grid grid-cols-1 gap-4">
          {/* Trinca de cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch auto-rows-[minmax(0,1fr)]">
            {/* Patrimônio ao aposentar */}
            <div className="rounded-xl border p-4 min-h-[180px] md:min-h-[200px] min-w-0 h-full flex flex-col overflow-hidden bg-white">
              <div className="rounded-xl border px-4 py-3 bg-white/70">
                <div className="text-slate-600 text-lg">Patrimônio ao aposentar</div>
                <div className="font-semibold leading-tight tabular-nums tracking-tight
                                text-[clamp(1.1rem,2.2vw,1.75rem)] md:text-[clamp(1.3rem,2.4vw,2rem)]
                                whitespace-nowrap overflow-hidden text-ellipsis inline-block max-w-full">
                  {formatCurrency(wealthAtRetire)}
                </div>
                <div className="text-slate-700 mt-1">Horizonte: {retireAge - age} anos</div>
              </div>
            </div>

            {/* Cobertura estimada */}
            <div className="rounded-xl border p-4 min-h-[180px] md:min-h-[200px] min-w-0 h-full flex flex-col overflow-hidden bg-[var(--accent)] ring-1 ring-yellow-200">
              <div className="text-slate-700 text-lg">Cobertura estimada</div>
              <div className="mt-1 inline-flex items-center rounded-full bg-white/70 border px-3 py-1 text-xs text-slate-700 w-max">
                com gasto de {formatCurrency(monthlySpend)}/mês
              </div>

              <div className="text-[clamp(1.4rem,3vw,2.2rem)] font-extrabold mt-2">
                {hasPerpetuity ? "Atingível" : `${formatNumber(runwayYears, 1)} anos`}
              </div>

              <div className="text-slate-700 text-sm mt-1">
                {hasPerpetuity ? (
                  <>
                    Com {formatNumber(retireRealReturn, 1)}% real a.a.,{" "}
                    <span className="whitespace-nowrap">
                      gasto de {formatCurrency(monthlySpend)}/mês
                    </span>{" "}
                    é sustentável.
                  </>
                ) : (
                  <>Até ~{formatNumber(endAge, 1)} anos de idade.</>
                )}
              </div>

              <div className="text-slate-800 text-sm mt-2">
                <em>ou</em> gasto sustentável:{" "}
                <span className="font-semibold text-[var(--brand-dark)]">
                  {formatCurrency(sustainableMonthlySWR)}/mês
                </span>
              </div>
            </div>

            {/* Poupança extra necessária */}
            <div className="rounded-xl border p-4 min-h-[180px] md:min-h-[200px] min-w-0 h-full flex flex-col overflow-hidden bg-white">
              <div className="text-slate-700 text-lg">Plano de ação</div>
              <div className="text-slate-500 text-sm">Poupança extra necessária</div>
              <div className="text-[clamp(1.4rem,3vw,2.2rem)] font-extrabold text-slate-900 mt-1">
                {formatCurrency(extraMonthlyToHitTarget)}/mês
              </div>
              <div className="text-slate-700 text-sm mt-2 leading-snug">
                Mantendo a poupança atual e os aportes, meta em{" "}
                {isFinite(monthsToGoal)
                  ? `~${formatNumber(monthsToGoal / 12, 1)} anos (aos ~${formatNumber(
                      ageAtGoal,
                      1
                    )} anos de idade)`
                  : "—"}
              </div>
            </div>
          </div>

          {/* Gráfico */}
          <div className="rounded-2xl bg-white border shadow-sm p-4">
            <div className="text-lg font-semibold mb-2">
              Acumulação até a aposentadoria{" "}
              <span className="text-slate-600 text-sm">
                (valores reais, já ajustados à inflação)
              </span>
            </div>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="gradWealth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={brand.dark} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={brand.dark} stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="gradGoal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7dbb3a" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#7dbb3a" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="age"
                    type="number"
                    domain={[age, 100]}
                    ticks={tickAges}
                    tickFormatter={(v) => `${Math.round(v)} anos`}
                  />
                  <YAxis
                    tickFormatter={(v) => `${formatNumber(v / 1_000_000, 1)} mi`}
                  />
                  <Tooltip
                    formatter={tooltipFormatter}
                    labelFormatter={(lbl) =>
                      `${formatNumber(lbl, 1)} anos`
                    }
                  />
                  <Legend
                    verticalAlign="top"
                    height={24}
                    iconType="circle"
                    formatter={(v) => (
                      <span className="text-slate-700 text-sm">{v}</span>
                    ) as any}
                  />

                  <ReferenceLine
                    x={series[retireIndex]?.age ?? retireAge}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    label={{
                      value: `Aposentadoria (${retireAge} anos)`,
                      position: "insideTopLeft",
                      fontSize: 12,
                      fill: "#64748b",
                    }}
                  />

                  <Area
                    type="monotone"
                    dataKey="goal"
                    name="Meta de aposentadoria (SWR)"
                    stroke="#7dbb3a"
                    fill="url(#gradGoal)"
                    dot={false}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="wealth"
                    name="Patrimônio projetado (real)"
                    stroke={brand.dark}
                    fill="url(#gradWealth)"
                    dot={false}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 my-6">
        <div className="rounded-2xl bg-white border p-4 text-slate-700 text-sm">
          <div className="font-semibold mb-1">Como usar (rápido)</div>
          <ol className="list-decimal pl-5 space-y-1">
            <li>
              Preencha idade atual, idade de aposentadoria, patrimônio atual, poupança
              mensal e gasto mensal na aposentadoria —{" "}
              <strong>todos em valores reais</strong> (já ajustados pela inflação).
            </li>
            <li>
              Ajuste o <strong>SWR</strong> no slider; a barra mostra o valor atual.
              Referência: <strong>3,5%</strong> é um nível histórico/realista; acima de{" "}
              <strong>5%</strong> tende a ser mais agressivo.
            </li>
            <li>
              Adicione <strong>contribuições pontuais</strong> (vendas/bônus) informando o valor e o mês
              em que entram.
            </li>
            <li>
              Opcional: em <strong>Mostrar avançado</strong>, ajuste o{" "}
              <strong>retorno real na aposentadoria</strong> para ver por quantos anos o
              patrimônio cobre o gasto ou se é sustentável (perpetuidade).
            </li>
            <li>
              Veja o <strong>número mágico</strong>, o <strong>patrimônio ao aposentar</strong>,
              a <strong>cobertura estimada</strong> e, se faltar, a{" "}
              <strong>poupança extra necessária</strong> e o tempo estimado para atingir a meta.
            </li>
          </ol>
          <div className="text-[12px] mt-2">
            MVP educativo; não é aconselhamento financeiro.
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Inputs e componentes menores
========================= */

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <SmallLabel>{label}</SmallLabel>
      <NumberInput value={value} onChange={onChange} />
    </div>
  );
}

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <SmallLabel>{label}</SmallLabel>
      <MoneyInput value={value} onChange={onChange} />
    </div>
  );
}

function SmallLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`text-sm font-medium text-slate-800 ${className || ""}`}>
      {children}
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      className="mt-1 w-full rounded-xl border px-3 py-2 bg-white"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(parseFloat(e.target.value || "0"))}
    />
  );
}

function MoneyInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const [txt, setTxt] = useState(formatCurrency(value));
  useEffect(() => {
    setTxt(formatCurrency(value));
  }, [value]);
  return (
    <input
      type="text"
      className="mt-1 w-full rounded-xl border px-3 py-2 bg-white"
      inputMode="numeric"
      value={txt}
      onChange={(e) => {
        const raw = parseMoneyInput(e.target.value);
        setTxt(formatCurrency(raw));
        onChange(raw);
      }}
    />
  );
}

