import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Area,
  Legend,
  ReferenceLine,
} from "recharts";
import "./index.css";

/* =========================
   Helpers numéricos & UI
========================= */
const BRL = (n: number, d = 0) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });

const fmt = (n: number, d = 0) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const isFiniteNumber = (n: any) => typeof n === "number" && Number.isFinite(n);
const safe = (n: any, fb = 0) => (isFiniteNumber(n) ? n : fb);

// taxa mensal efetiva a partir da taxa real anual (%)
const monthlyRateFromRealAnnual = (realAnnualPct: number) =>
  Math.pow(1 + realAnnualPct / 100, 1 / 12) - 1;

/* =========================
   Component
========================= */
export default function App() {
  /* ---------- Defaults ---------- */
  const [age, setAge] = useState<number>(24);
  const [retireAge, setRetireAge] = useState<number>(34);

  const [currentWealth, setCurrentWealth] = useState<number>(3_000_000);
  const [monthlySave, setMonthlySave] = useState<number>(120_000);
  const [monthlySpend, setMonthlySpend] = useState<number>(100_000);

  // contribuição pontual única (valor + mês)
  const [lump, setLump] = useState<{ value: number; month: number }>({
    value: 5_000_000,
    month: 12,
  });

  // SWR e retornos
  const [swrPct, setSwrPct] = useState<number>(3.5); // %
  const [accumReal, setAccumReal] = useState<number>(5); // %
  const [retireReal, setRetireReal] = useState<number>(3.5); // %
  const [advanced, setAdvanced] = useState<boolean>(false);

  // quando NÃO avançado → SWR e retorno real na aposentadoria mexem juntos
  const effectiveRetireReal = advanced ? retireReal : swrPct;
  const effectiveSwr = advanced ? swrPct : retireReal;

  /* ---------- Conversões ---------- */
  const mAccum = monthlyRateFromRealAnnual(accumReal);
  const mRetire = monthlyRateFromRealAnnual(effectiveRetireReal);
  const horizonM = Math.max(0, Math.round((retireAge - age) * 12));

  // número mágico coerente com a taxa mensal efetiva (mensalidade / taxa mensal)
  const targetWealth = safe(monthlySpend / Math.max(mRetire, 1e-10));

  /* ---------- Projeção completa (mensal, em termos reais) ---------- */
  const projection = useMemo(() => {
    let w = currentWealth;
    const out: { m: number; wealth: number }[] = [];
    const maxM = Math.max(horizonM + 1, (100 - age) * 12); // até 100 anos no gráfico

    for (let m = 0; m <= maxM; m++) {
      if (m === lump.month) w += lump.value; // aporte único

      if (m < horizonM) {
        w = w * (1 + mAccum) + monthlySave;
      } else {
        w = w * (1 + mRetire) - monthlySpend;
      }
      out.push({ m, wealth: w });
    }
    return out;
  }, [age, horizonM, currentWealth, monthlySave, monthlySpend, lump, mAccum, mRetire]);

  const wealthAtRetire =
    projection.find((r) => r.m === horizonM)?.wealth ?? (projection[projection.length - 1]?.wealth ?? 0);

  // Progresso rumo ao número mágico
  const progressPct = clamp((wealthAtRetire / targetWealth) * 100, 0, 100);

  /* ---------- “Runway” de cobertura: até zerar patrimônio (se não perpetuidade) ---------- */
  const hasPerpetuity = wealthAtRetire >= targetWealth;
  const runwayM = useMemo(() => {
    if (hasPerpetuity) return Infinity;
    for (let i = horizonM; i < projection.length; i++) {
      if (projection[i].wealth <= 0) return i - horizonM; // meses após aposentadoria
    }
    return Infinity;
  }, [hasPerpetuity, horizonM, projection]);

  const runwayY = Number.isFinite(runwayM) ? runwayM / 12 : Infinity;
  const endAge = Number.isFinite(runwayM) ? retireAge + runwayY : Infinity;

  // Tratamento “quase meta” (exibir mensagem em vez de “- anos”)
  const nearPerpetuity = !Number.isFinite(runwayY) || runwayY > 120;

  // Mensagens de idade longuíssima
  const endAgeMessage =
    Number.isFinite(endAge) && endAge > 123
      ? " (você terá entrado para o guiness)"
      : Number.isFinite(endAge) && endAge > 100
      ? " (parabéns para você, caso chegue a essa idade)"
      : "";

  /* ---------- Chart data (sanitizado) ---------- */
  const chartData = useMemo(
    () =>
      projection
        .map((row) => ({
          Meses: row.m,
          "Patrimônio projetado (real)": safe(row.wealth),
          "Meta de aposentadoria (SWR)": safe(targetWealth),
        }))
        .filter(
          (d) =>
            isFiniteNumber(d.Meses) &&
            isFiniteNumber(d["Patrimônio projetado (real)"]) &&
            isFiniteNumber(d["Meta de aposentadoria (SWR)"])
        ),
    [projection, targetWealth]
  );

  /* ---------- Tempo até a meta no plano atual (card da direita) ---------- */
  // simplificação: usando bissecção em meses para achar o primeiro mês em que wealth >= target
  const monthsToGoalAtCurrentPlan = useMemo(() => {
    let lo = 0;
    let hi = (retireAge - age + 60) * 12; // até +60 anos após hoje como limite alto
    const simulate = (months: number) => {
      let w = currentWealth;
      for (let m = 0; m <= months; m++) {
        if (m === lump.month) w += lump.value;
        if (m < horizonM) {
          w = w * (1 + mAccum) + monthlySave;
        } else {
          // depois da aposentadoria, paramos de contribuir; só simulando acumul até meta
          w = w * (1 + mRetire); // sem retirar (meta é atingir o target)
        }
        if (m === horizonM && w >= targetWealth) return m; // já bate na aposentadoria
        if (w >= targetWealth) return m;
      }
      return Infinity;
    };
    for (let i = 0; i < 40; i++) {
      const mid = Math.floor((lo + hi) / 2);
      const t = simulate(mid);
      if (t === Infinity) lo = mid + 1;
      else hi = mid;
    }
    const t = simulate(hi);
    return t === Infinity ? Infinity : hi;
  }, [age, retireAge, currentWealth, monthlySave, lump, horizonM, mAccum, mRetire, targetWealth]);

  /* ---------- UI ---------- */
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded-xl bg-emerald-200/60 text-emerald-900 font-semibold">
            Nomos Sports
          </span>
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-[var(--brand-dark,#082422)]">
            Calculadora de Aposentadoria para Atletas
          </h1>
        </div>
        <a
          href="https://wa.me/"
          className="hidden sm:inline-flex items-center px-4 py-2 rounded-xl bg-emerald-500 text-white font-semibold shadow hover:bg-emerald-600 transition"
        >
          Falar com um especialista no WhatsApp
        </a>
      </div>

      {/* Top KPIs */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Número mágico */}
        <div className="rounded-2xl border p-4 md:p-6 bg-white/70">
          <div className="text-slate-500 text-sm mb-1">Número mágico (SWR)</div>
          <div className="text-3xl md:text-5xl font-extrabold text-emerald-900">
            {BRL(targetWealth, 0)}
          </div>
          <div className="text-slate-600 text-sm">
            {fmt(effectiveSwr, 1)}% a.a. com gasto de {BRL(monthlySpend, 0)}/mês
          </div>
        </div>

        {/* Progresso rumo ao número mágico */}
        <div className="rounded-2xl border p-4 md:p-6 bg-white/70">
          <div className="text-slate-500 text-sm mb-1">Progresso rumo ao número mágico</div>
          <div className="text-3xl md:text-5xl font-extrabold text-emerald-900">
            {fmt(progressPct, 0)}%
          </div>
          <div className="h-2 rounded-full bg-slate-200 overflow-hidden mt-2">
            <div
              className="h-full bg-emerald-800"
              style={{ width: `${progressPct}%`, transition: "width .4s" }}
            />
          </div>
          <div className="mt-2 text-sm">
            {wealthAtRetire >= targetWealth ? (
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">
                Você superou a meta!
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                Faltam {BRL(targetWealth - wealthAtRetire, 0)} para o número mágico
              </span>
            )}
          </div>
        </div>

        {/* Parâmetros resumidos do patrimônio ao aposentar */}
        <div className="rounded-2xl border p-4 md:p-6 bg-white/70">
          <div className="text-slate-500 text-sm mb-1">Patrimônio ao aposentar</div>
          <div className="text-3xl md:text-5xl font-extrabold text-slate-900">
            {BRL(wealthAtRetire, 0)}
          </div>
          <div className="text-slate-600 text-sm">Horizonte: {retireAge - age} anos</div>
        </div>
      </div>

      {/* Cards principais (meio) */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Cobertura / Perpetuidade */}
        <div
          className={`rounded-2xl border p-4 md:p-6 ${
            hasPerpetuity ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
          }`}
        >
          <div className="text-slate-600 text-sm mb-1">
            {hasPerpetuity ? "Perpetuidade" : "Cobertura estimada"}
          </div>
          <div className="mb-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-900 border border-emerald-200">
              com gasto de {BRL(monthlySpend, 0)}/mês
            </span>
          </div>

          <div className="text-2xl md:text-4xl font-semibold text-[var(--brand-dark,#082422)]">
            {hasPerpetuity
              ? "Atingível"
              : nearPerpetuity
              ? "Perpetuidade praticamente atingida"
              : `${fmt(runwayY, 1)} anos`}
          </div>

          <div className="text-xs md:text-sm text-slate-700 mt-1">
            {hasPerpetuity ? (
              <>Com {fmt(effectiveRetireReal, 1)}% real a.a.</>
            ) : nearPerpetuity ? null : (
              <>
                até ~{fmt(endAge, 1)} anos de idade{endAgeMessage}
              </>
            )}
          </div>
        </div>

        {/* Plano de ação */}
        <div className="rounded-2xl border p-4 md:p-6 bg-white/70">
          <div className="text-slate-600 text-sm mb-1">Plano de ação</div>
          {wealthAtRetire >= targetWealth ? (
            <div className="text-2xl md:text-3xl font-extrabold text-emerald-800">
              Meta atingida com as premissas atuais.
            </div>
          ) : (
            <>
              {/* cálculo simples de poupança extra mensal se quisesse atingir no horizonte atual */}
              <div className="text-2xl md:text-3xl font-extrabold">
                {(() => {
                  const gap = Math.max(0, targetWealth - wealthAtRetire);
                  const addPerMonth = horizonM > 0 ? gap / horizonM : gap;
                  return <>Poupança extra necessária {BRL(addPerMonth, 0)}/mês</>;
                })()}
              </div>
              {Number.isFinite(monthsToGoalAtCurrentPlan) && monthsToGoalAtCurrentPlan > 0 && (
                <div className="text-slate-600 text-sm mt-1">
                  Mantendo a poupança atual e os aportes, meta em ~
                  {monthsToGoalAtCurrentPlan > 24
                    ? ` ${fmt(monthsToGoalAtCurrentPlan / 12, 1)} anos`
                    : ` ${fmt(monthsToGoalAtCurrentPlan, 0)} meses`}{" "}
                  (idade ~ {fmt(age + monthsToGoalAtCurrentPlan / 12, 1)} anos)
                </div>
              )}
            </>
          )}
        </div>

        {/* Caixa “dummy” para manter layout de 3 colunas quando necessário */}
        <div className="rounded-2xl border p-4 md:p-6 bg-white/70">
          <div className="text-slate-600 text-sm mb-1">Parâmetros</div>
          <div className="text-slate-700 text-sm">
            Idade atual {fmt(age)} • Idade de aposentadoria {fmt(retireAge)}
            <br />
            Poupança mensal {BRL(monthlySave, 0)} • Patrimônio atual {BRL(currentWealth, 0)}
          </div>
        </div>
      </div>

      {/* Gráfico */}
      <div className="rounded-2xl border p-4 md:p-6 bg-white/70">
        <div className="text-slate-700 font-medium mb-2">
          Acumulação até a aposentadoria (valores reais, já ajustados à inflação)
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="Meses"
                tickFormatter={(m) => `${fmt(age + m / 12, 0)} anos`}
              />
              <YAxis />
              <Legend />
              <ReferenceLine
                x={horizonM}
                stroke="#374151"
                label={`Aposentadoria (${fmt(retireAge, 0)} anos)`}
              />
              <Area
                type="monotone"
                dataKey="Patrimônio projetado (real)"
                stroke="#065f46"
                fill="#a7f3d0"
              />
              <Area
                type="monotone"
                dataKey="Meta de aposentadoria (SWR)"
                stroke="#d97706"
                fill="#fef3c7"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-sm text-slate-600">Dados insuficientes para exibir o gráfico.</div>
        )}
      </div>

      {/* Parâmetros (lado esquerdo, simplificado) */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-4 md:p-6 bg-white/70 md:col-span-3">
          <div className="text-lg font-semibold mb-3">Parâmetros</div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Idade atual">
              <input
                type="number"
                className="input"
                value={age}
                onChange={(e) => setAge(clamp(Number(e.target.value), 15, 90))}
              />
            </Field>
            <Field label="Idade de aposentadoria">
              <input
                type="number"
                className="input"
                value={retireAge}
                onChange={(e) =>
                  setRetireAge(clamp(Number(e.target.value), age + 1, 90))
                }
              />
            </Field>
            <Field label="Patrimônio atual (BRL)">
              <Currency value={currentWealth} onChange={setCurrentWealth} />
            </Field>
            <Field label="Poupança mensal (BRL)">
              <Currency value={monthlySave} onChange={setMonthlySave} />
            </Field>
            <Field label="Gasto mensal na aposentadoria (BRL)">
              <Currency value={monthlySpend} onChange={setMonthlySpend} />
            </Field>

            <div className="rounded-xl border p-3">
              <div className="text-sm text-slate-600 mb-2">
                Contribuições pontuais (valor e mês)
              </div>
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                <Currency value={lump.value} onChange={(v) => setLump({ ...lump, value: v })} />
                <div className="text-sm text-slate-600">mês:</div>
                <input
                  type="number"
                  className="input w-24"
                  value={lump.month}
                  onChange={(e) =>
                    setLump({ ...lump, month: clamp(Number(e.target.value), 0, 240) })
                  }
                />
              </div>
            </div>

            <div className="rounded-xl border p-3">
              <div className="text-sm font-medium text-slate-700 mb-2">
                SWR — Taxa segura de retirada (% a.a.)
              </div>
              <Range
                min={1}
                max={7}
                step={0.1}
                value={swrPct}
                onChange={setSwrPct}
                hint="Atual: 3,5% — 3,5% é um nível histórico/realista; acima de 5% tende a ser mais agressivo."
              />
            </div>

            <div className="rounded-xl border p-3">
              <div className="text-sm font-medium text-slate-700 mb-2">
                Retorno real na acumulação (% a.a.)
              </div>
              <Range min={0} max={10} step={0.1} value={accumReal} onChange={setAccumReal} />
            </div>

            <div className="rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-slate-700">
                  Retorno real na aposentadoria (% a.a.)
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={advanced}
                    onChange={(e) => setAdvanced(e.target.checked)}
                  />
                  Mostrar avançado
                </label>
              </div>

              <Range
                min={0}
                max={10}
                step={0.1}
                value={advanced ? retireReal : effectiveRetireReal}
                onChange={(v) => (advanced ? setRetireReal(v) : (setRetireReal(v), setSwrPct(v)))}
                disabled={!advanced}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Subcomponentes de UI
========================= */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function Currency({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <input
      type="text"
      className="input"
      value={fmt(value, 0)}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^\d]/g, "");
        onChange(Number(digits || 0));
      }}
    />
  );
}

function Range({
  min,
  max,
  step,
  value,
  onChange,
  disabled,
  hint,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full"
        />
        <div className="w-20 text-right text-sm">{fmt(value, 1)}%</div>
      </div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}
