import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Area,
  Legend,
  ReferenceLine,
  ReferenceArea,
} from "recharts";

/* ===========================
   UI PRIMITIVES (Tailwind)
=========================== */
const Section: React.FC<React.PropsWithChildren<{ className?: string }>> = ({
  children,
  className,
}) => (
  <div
    className={`rounded-2xl border border-[var(--brand-gray)] bg-white shadow-sm p-4 sm:p-5 ${className || ""}`}
  >
    {children}
  </div>
);

const Label: React.FC<React.PropsWithChildren> = ({ children }) => (
  <label className="text-sm font-medium text-slate-800">{children}</label>
);

const BaseInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>((props, ref) => (
  <input
    ref={ref}
    {...props}
    className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm text-right tabular-nums tracking-tight outline-none focus:ring-2 focus:ring-[var(--brand-lime)] ${
      props.className || ""
    }`}
  />
));
BaseInput.displayName = "BaseInput";

const Button: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "solid" | "outline";
}> = ({ children, onClick, variant = "solid" }) => (
  <button
    onClick={onClick}
    className={`h-10 rounded-xl px-4 text-sm font-medium transition ${
      variant === "outline"
        ? "border border-[var(--brand-gray)] bg-white text-[var(--brand-dark)] hover:bg-[var(--brand-offwhite)]"
        : "bg-[var(--brand-dark)] text-white hover:brightness-95"
    }`}
  >
    {children}
  </button>
);

/* ========= Slider SWR (custom, sem tooltip acima) ========= */
const SwrSlider: React.FC<{
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}> = ({ value, min, max, step, onChange }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    const measure = () => setW(el?.offsetWidth ?? 0);
    measure();
    window.addEventListener("resize", measure);
    const ro = "ResizeObserver" in window ? new ResizeObserver(measure) : null;
    if (el && ro) ro.observe(el);
    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, []);

  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const thumb = 20; // diâmetro do knob
  const center = w ? thumb / 2 + (w - thumb) * t : 0;
  const fill = Math.max(thumb / 2, Math.min(center, w));

  return (
    <div className="relative select-none pt-2">
      <div ref={wrapRef} className="relative h-8">
        {/* trilho base */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-slate-200 ring-1 ring-[var(--brand-gray)]" />
        {/* preenchimento */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-2 rounded-full"
          style={{
            width: `${fill}px`,
            background:
              "linear-gradient(90deg, var(--brand-lime) 0%, #9edf5e 100%)",
          }}
        />
        {/* knob */}
        <div
          className="absolute -translate-x-1/2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-[var(--brand-dark)] border-2 border-white shadow ring-1 ring-[var(--brand-gray)]"
          style={{ left: `${center}px` }}
        />
        {/* input invisível (acessível) */}
        <input
          type="range"
          aria-label="SWR (taxa segura de retirada)"
          className="absolute inset-0 opacity-0 cursor-pointer"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      <div className="mt-1 text-xs text-slate-500">
        Atual: {formatNumber(value, 1)}% ·{" "}
        <span className="text-[var(--brand-dark)] font-medium">3,5% é um nível histórico/realista</span>; acima de <span className="font-medium">5%</span> tende a ser mais agressivo.
      </div>
    </div>
  );
};

const Switch: React.FC<{ checked: boolean; onChange: (b: boolean) => void }> = ({
  checked,
  onChange,
}) => (
  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
    <span
      className={`h-5 w-9 rounded-full transition ${
        checked ? "bg-[var(--brand-dark)]" : "bg-slate-300"
      }`}
    >
      <span
        className={`block h-5 w-5 rounded-full bg-white shadow -mt-[2px] transition ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      ></span>
    </span>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="hidden"
    />
  </label>
);

/* ======= Progress Bar ======= */
const ProgressBar: React.FC<{ value: number }> = ({ value }) => {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className="h-3 w-full rounded-full bg-slate-200/70 overflow-hidden ring-1 ring-[var(--brand-gray)]"
      role="progressbar"
      aria-label="Percentual do número mágico"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div className="h-full bg-[var(--brand-dark)]" style={{ width: `${pct}%` }} />
    </div>
  );
};

/* ===========================
   INPUTS BR COM MILHAR (live)
=========================== */
const nfBR = new Intl.NumberFormat("pt-BR");
function formatBRInt(n: number) {
  if (!isFinite(n)) return "";
  return nfBR.format(Math.trunc(n));
}
function parseDigits(s: string) {
  return (s || "").replace(/\D+/g, "");
}
function countDigitsLeft(str: string, pos: number) {
  let c = 0;
  for (let i = 0; i < Math.max(0, Math.min(pos, str.length)); i++) if (/\d/.test(str[i])) c++;
  return c;
}
function posFromDigitsCount(str: string, digitsCount: number) {
  let c = 0;
  for (let i = 0; i < str.length; i++) {
    if (/\d/.test(str[i])) c++;
    if (c >= digitsCount) return i + 1;
  }
  return str.length;
}
function NumericInputBR({
  value,
  onChange,
  placeholder,
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(value ? formatBRInt(value) : "");
  useEffect(() => {
    const next = value ? formatBRInt(value) : "";
    if (next !== text) setText(next);
  }, [value]);
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const sel = e.target.selectionStart ?? raw.length;
    const digitsBefore = countDigitsLeft(raw, sel);
    const only = parseDigits(raw);
    if (only.length === 0) {
      setText("");
      onChange(0);
      requestAnimationFrame(() => {
        const el = ref.current;
        if (el) el.setSelectionRange(0, 0);
      });
      return;
    }
    const n = Number(only);
    const formatted = formatBRInt(n);
    setText(formatted);
    onChange(n);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const caret = posFromDigitsCount(formatted, digitsBefore);
      el.setSelectionRange(caret, caret);
    });
  }
  return <BaseInput ref={ref} inputMode="numeric" placeholder={placeholder} value={text} onChange={handleChange} />;
}
function NumericInputBRSigned({
  value,
  onChange,
  placeholder,
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(
    value || value === 0 ? (value < 0 ? "-" : "") + formatBRInt(Math.abs(value)) : ""
  );
  useEffect(() => {
    const next = value || value === 0 ? (value < 0 ? "-" : "") + formatBRInt(Math.abs(value)) : "";
    if (next !== text) setText(next);
  }, [value]);
  function handleChange(e: React.Change<HTMLInputElement>) {
    const raw = e.target.value.trim();
    const isNeg = raw.startsWith("-");
    const only = raw.replace(/\D+/g, "");
    if (!only) {
      setText(isNeg ? "-" : "");
      onChange(0);
      requestAnimationFrame(() => {
        const el = ref.current;
        if (el) el.setSelectionRange(isNeg ? 1 : 0, isNeg ? 1 : 0);
      });
      return;
    }
    const nAbs = Number(only);
    const n = isNeg ? -nAbs : nAbs;
    const formatted = (isNeg ? "-" : "") + formatBRInt(Math.abs(n));
    setText(formatted);
    onChange(n);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const caret = formatted.length;
      el.setSelectionRange(caret, caret);
    });
  }
  return <BaseInput ref={ref} inputMode="numeric" placeholder={placeholder} value={text} onChange={handleChange} />;
}

/* ===========================
   HELPERS DE CÁLCULO
=========================== */
function formatCurrency(value: number, code = "BRL") {
  if (!isFinite(value)) return "-";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 0,
  }).format(value);
}
function formatNumber(value: number, digits = 2) {
  if (!isFinite(value)) return "-";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(value);
}
function monthlyRateFromRealAnnual(realAnnualPct: number) {
  return Math.pow(1 + realAnnualPct / 100, 1 / 12) - 1;
}
type Lump = { id: number; month: number; amount: number };

/* projeção até a aposentadoria (só acumulação) */
function projectToRetirement({
  currentWealth,
  monthlySaving,
  months,
  monthlyRealReturn,
  lumpSums,
}: {
  currentWealth: number;
  monthlySaving: number;
  months: number;
  monthlyRealReturn: number;
  lumpSums: Lump[];
}) {
  const rows: { m: number; wealth: number }[] = [];
  let W = currentWealth;
  const byMonth = new Map<number, number>();
  for (const ls of lumpSums) {
    const m = Math.max(0, Math.min(months, Math.floor(ls.month)));
    byMonth.set(m, (byMonth.get(m) || 0) + (Number(ls.amount) || 0));
  }
  for (let t = 0; t <= months; t++) {
    rows.push({ m: t, wealth: W });
    const oneOff = byMonth.get(t + 1) || 0;
    W = W * (1 + monthlyRealReturn) + monthlySaving + oneOff;
  }
  return rows;
}

/* projeção completa até 100 anos: acumula antes e saca depois */
function projectFullTo100({
  age,
  currentWealth,
  monthsToRetire,
  monthlySaving,
  monthlyAccumReturn,
  monthlyRetireReturn,
  monthlySpend,
  lumpSums,
}: {
  age: number;
  currentWealth: number;
  monthsToRetire: number;
  monthlySaving: number;
  monthlyAccumReturn: number;
  monthlyRetireReturn: number;
  monthlySpend: number;
  lumpSums: Lump[];
}) {
  const monthsTo100 = Math.max(0, (100 - age) * 12);
  const rows: { m: number; wealth: number }[] = [];
  let W = currentWealth;

  const byMonth = new Map<number, number>();
  for (const ls of lumpSums) {
    const m = Math.max(0, Math.min(monthsToRetire, Math.floor(ls.month)));
    byMonth.set(m, (byMonth.get(m) || 0) + (Number(ls.amount) || 0));
  }

  for (let t = 0; t <= monthsTo100; t++) {
    rows.push({ m: t, wealth: Math.max(0, W) });
    if (t < monthsToRetire) {
      const oneOff = byMonth.get(t + 1) || 0;
      W = W * (1 + monthlyAccumReturn) + monthlySaving + oneOff;
    } else {
      W = W * (1 + monthlyRetireReturn) - monthlySpend;
    }
  }
  return rows;
}

/* ===========================
   APP
=========================== */
export default function App() {
  const themeVars = {
    ["--brand-dark" as any]: "#021e19",
    ["--brand-lime" as any]: "#c8e05b",
    ["--brand-offwhite" as any]: "#f4ece6",
    ["--brand-gray" as any]: "#a6a797",
  };

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [age, setAge] = useState(24);
  const [retireAge, setRetireAge] = useState(34);
  const [currentWealth, setCurrentWealth] = useState(3_000_000);
  const [monthlySaving, setMonthlySaving] = useState(120_000);
  const [monthlySpend, setMonthlySpend] = useState(100_000);
  const [swrPct, setSwrPct] = useState(3.5);
  const [accumRealReturn, setAccumRealReturn] = useState(5);
  const [retireRealReturn, setRetireRealReturn] = useState(3.5);
  // Mantém SWR e Retorno na aposentadoria sincronizados quando o modo avançado está desligado
  useEffect(() => {
    if (!showAdvanced) {
      setRetireRealReturn(swrPct);
    }
  }, [showAdvanced, swrPct]);

  const [lumpSums, setLumpSums] = useState<Lump[]>([{ id: 1, month: 12, amount: 5_000_000 }]);

  const monthsToRetire = Math.max(0, (retireAge - age) * 12);
  const monthsTo100 = Math.max(0, (100 - age) * 12);
  const monthlyAccum = monthlyRateFromRealAnnual(accumRealReturn);
  const monthlyRetire = monthlyRateFromRealAnnual(retireRealReturn);

  /* acumulação pura (para métricas) */
  const accumulation = useMemo(
    () =>
      projectToRetirement({
        currentWealth,
        monthlySaving,
        months: monthsToRetire,
        monthlyRealReturn: monthlyAccum,
        lumpSums,
      }),
    [currentWealth, monthlySaving, monthsToRetire, monthlyAccum, lumpSums]
  );
  const wealthAtRetire = accumulation[accumulation.length - 1]?.wealth ?? currentWealth;

  /* projeção completa até 100 anos (para o gráfico) */
  const fullProjection = useMemo(
    () =>
      projectFullTo100({
        age,
        currentWealth,
        monthsToRetire,
        monthlySaving,
        monthlyAccumReturn: monthlyAccum,
        monthlyRetireReturn: monthlyRetire,
        monthlySpend,
        lumpSums,
      }),
    [age, currentWealth, monthsToRetire, monthlySaving, monthlyAccum, monthlyRetire, monthlySpend, lumpSums]
  );

  const targetWealth = monthlySpend / Math.max(monthlyRetire, 1e-9);
  const gap = targetWealth - wealthAtRetire;
  const progressPct = Math.max(0, Math.min(100, (100 * wealthAtRetire) / Math.max(targetWealth, 1)));
  const diff = wealthAtRetire - targetWealth; // positivo = sobrou; negativo = falta

  /* sustentabilidade na aposentadoria */
  const sustainableMonthlySWR = wealthAtRetire * monthlyRetire;
  const hasPerpetuity = sustainableMonthlySWR >= monthlySpend;

  /* extra por mês para chegar no número mágico no tempo definido */
  const extraMonthlyNeeded =
    gap > 0 && monthsToRetire > 0
      ? gap / Math.max(monthlyAccum > 0 ? (Math.pow(1 + monthlyAccum, monthsToRetire) - 1) / monthlyAccum : monthsToRetire, 1)
      : 0;

  /* runway (anos) dado retorno real na aposentadoria */
  function yearsOfRunway({
    startingWealth,
    annualSpend,
    realReturnAnnual,
  }: {
    startingWealth: number;
    annualSpend: number;
    realReturnAnnual: number;
  }) {
    const r = realReturnAnnual / 100;
    if (annualSpend <= 0) return Infinity;
    if (r === 0) return startingWealth / annualSpend;
    const ratio = 1 - (startingWealth * r) / annualSpend;
    if (ratio <= 0) return Infinity;
    return -Math.log(ratio) / Math.log(1 + r);
  }
  const runwayY = yearsOfRunway({ startingWealth: wealthAtRetire, annualSpend: monthlySpend * 12, realReturnAnnual: retireRealReturn });
  const endAge = isFinite(runwayY) ? retireAge + runwayY : Infinity;
  const invalidRunway = !Number.isFinite(runwayY) || runwayY < 0;
  const runwayYearsLabel = invalidRunway ? "—" : formatNumber(runwayY, 1);
  const endAgeLabel = invalidRunway ? "—" : formatNumber(endAge, 1);
  const nearPerpetuity = invalidRunway || (Number.isFinite(runwayY) && runwayY > 120);
  const endAgeSuffix = !invalidRunway && endAge > 120
    ? ` (parabéns para você, caso chegue a essa idade)`
    : "";


  const monthsToGoalAtCurrentPlan = useMemo(() => {
    if (targetWealth <= 0) return 0;
    let W = currentWealth;
    const byMonth = new Map<number, number>();
    for (const ls of lumpSums) {
      const m = Math.max(1, Math.floor(ls.month));
      byMonth.set(m, (byMonth.get(m) || 0) + (Number(ls.amount) || 0));
    }
    const r = monthlyAccum;
    const cap = 1200;
    for (let t = 0; t <= cap; t++) {
      if (W >= targetWealth) return t;
      const oneOff = byMonth.get(t + 1) || 0;
      W = W * (1 + r) + monthlySaving + oneOff;
    }
    return Infinity;
  }, [targetWealth, currentWealth, monthlySaving, lumpSums, monthlyAccum]);

  /* dados do gráfico até 100 anos */
  const chartData = useMemo(
    () =>
      fullProjection.map((row) => ({
        Meses: row.m,
        "Patrimônio projetado (real)": row.wealth,
        "Meta de aposentadoria (SWR)": targetWealth,
      })),
    [fullProjection, targetWealth]
  );

  /* ticks do eixo X por idade, com menos rótulos (~8 labels) */
  const yearTicks = useMemo(() => {
    const yearsRange = 100 - age;
    let stepYears = Math.ceil(yearsRange / 8);
    if (stepYears >= 5) stepYears = Math.round(stepYears / 5) * 5;
    stepYears = Math.max(2, stepYears);
    const stepMonths = stepYears * 12;
    const list: number[] = [];
    for (let m = 0; m <= monthsTo100; m += stepMonths) list.push(m);
    if (list[list.length - 1] !== monthsTo100) list.push(monthsTo100);
    return list;
  }, [age, monthsTo100]);

  /* ações auxiliares */
  const addLump = () => setLumpSums((arr) => [...arr, { id: (arr[arr.length - 1]?.id || 0) + 1, month: 1, amount: 100_000 }]);
  const updateLump = (id: number, field: "month" | "amount", value: number) => setLumpSums((arr) => arr.map((ls) => (ls.id === id ? { ...ls, [field]: value } : ls)));
  const removeLump = (id: number) => setLumpSums((arr) => arr.filter((ls) => ls.id !== id));

  return (
    <div className="min-h-screen w-full p-4 sm:p-8" style={{ ...themeVars, backgroundColor: "var(--brand-offwhite)" }}>
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <span className="px-3 py-1 rounded-md bg-[var(--brand-dark)] text-[var(--brand-lime)] font-semibold">Nomos Sports</span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ color: "var(--brand-dark)" }}>
              Calculadora de Aposentadoria para Atletas
            </h1>
          </div>

          {/* Botão WhatsApp */}
          <a
            href="https://api.whatsapp.com/send?phone=5521986243416&text=Ol%C3%A1%21+Estava+mexendo+na+calculadora+de+aposentadoria+da+Nomos+Sports.+Podemos+bater+um+papo%3F"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 h-10 rounded-xl px-4 text-sm font-medium bg-[#25D366] text-white hover:brightness-95"
          >
            Falar com um especialista no WhatsApp
          </a>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Inputs */}
          <Section>
            <p className="font-semibold mb-4 text-xl">Parâmetros</p>

            {/* Campos principais */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Idade atual</Label>
                <BaseInput type="number" value={age} onChange={(e) => setAge(Number(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Idade de aposentadoria</Label>
                <BaseInput type="number" value={retireAge} onChange={(e) => setRetireAge(Number(e.target.value) || 0)} />
              </div>
              <div className="col-span-2">
                <Label>Patrimônio atual (BRL)</Label>
                <NumericInputBR value={currentWealth} onChange={setCurrentWealth} placeholder="0" />
              </div>
              <div className="col-span-2">
                <Label>Poupança mensal (BRL)</Label>
                <NumericInputBRSigned value={monthlySaving} onChange={setMonthlySaving} placeholder="0" />
              </div>
              <div className="col-span-2">
                <Label>Gasto mensal na aposentadoria (BRL)</Label>
                <NumericInputBR value={monthlySpend} onChange={setMonthlySpend} placeholder="0" />
              </div>
            </div>

            {/* ===== Contribuições pontuais ===== */}
            <div className="rounded-2xl border p-3 mt-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <Label>Contribuições pontuais (valor e mês)</Label>
                <Button variant="outline" onClick={addLump}>＋</Button>
              </div>
              <div className="space-y-2">
                {lumpSums.map((ls) => (
                  <div key={ls.id} className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:items-end">
                    <div className="col-span-12 sm:col-span-6">
                      <Label>Valor (BRL)</Label>
                      <NumericInputBR value={ls.amount} onChange={(n) => updateLump(ls.id, "amount", n)} />
                    </div>
                    <div className="col-span-12 sm:col-span-4">
                      <Label><span className="whitespace-nowrap">Mês em que entra</span></Label>
                      <BaseInput type="number" min={1} max={monthsToRetire} value={ls.month} onChange={(e) => updateLump(ls.id, "month", Number(e.target.value) || 1)} />
                      <p className="text-xs text-slate-500 mt-1 sm:hidden">1 = próximo mês … até {monthsToRetire}</p>
                    </div>
                    <div className="col-span-12 sm:col-span-2 flex justify-start sm:justify-end mt-1 sm:mt-0">
                      <Button variant="outline" onClick={() => removeLump(ls.id)}>－</Button>
                    </div>
                  </div>
                ))}
                {lumpSums.length === 0 && <p className="text-xs text-slate-500">Nenhum aporte único adicionado.</p>}
              </div>
            </div>

            {/* ===== SWR & Retornos ===== */}
            <div className="rounded-2xl border p-3 mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                {/* SWR */}
                <div>
                  <Label>SWR — Taxa segura de retirada (% a.a.)</Label>
                  <SwrSlider value={swrPct} onChange={(v)=>{ setSwrPct(v); if(!showAdvanced) setRetireRealReturn(v); }} min={2.5} max={8} step={0.1} />
                </div>
                {/* Retorno na acumulação */}
                <div>
                  <Label>Retorno real na acumulação (% a.a.)</Label>
                  <BaseInput type="number" step={0.1} value={accumRealReturn} onChange={(e) => setAccumRealReturn(Number(e.target.value) || 0)} />
                </div>
                {/* Avançado: retorno na aposentadoria */}
                {showAdvanced && (
                  <>
                    <div aria-hidden className="hidden sm:block" />
                    <div>
                      <Label>Retorno real na aposentadoria (% a.a.)</Label>
                      <BaseInput type="number" step={0.1} value={retireRealReturn} onChange={(e) => setRetireRealReturn(Number(e.target.value) || 0)} />
                    </div>
                  </>
                )}
              </div>
              {/* Aviso quando SWR ≠ retorno na aposentadoria */}
              {showAdvanced && Math.abs(swrPct - retireRealReturn) > 0.01 && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2 text-xs">
                  <span className="font-semibold">Atenção:</span> o SWR informado ({formatNumber(swrPct,1)}%) é diferente do retorno real na aposentadoria ({formatNumber(retireRealReturn,1)}%). Atingir o número mágico não garante perpetuidade quando o retorno for menor que o SWR.
                </div>
              )}
              {/* Toggle avançado */}
              <div className="flex items-center gap-2">
                <Switch checked={showAdvanced} onChange={setShowAdvanced} />
                <span className="text-sm">Mostrar avançado</span>
              </div>
            </div>
          </Section>

          {/* Outputs */}
          <div className="lg:col-span-2 space-y-6">
            {/* HERO: Número mágico + Progresso */}
            <Section>
              <div className="grid md:grid-cols-5 gap-6 items-center">
                {/* Número mágico super destacado */}
                <div className="md:col-span-3">
                  <div className="text-xs text-slate-500">Número mágico (SWR)</div>
                  <div className="mt-1 text-4xl md:text-5xl font-extrabold tracking-tight text-[var(--brand-dark)]">
                    {formatCurrency(targetWealth, "BRL")}
                  </div>
                  <div className="text-slate-600 text-sm">
                    {formatNumber(swrPct, 1)}% a.a. com gasto de {formatCurrency(monthlySpend, "BRL")}/mês
                  </div>
                </div>

                {/* Progresso consolidado ao lado */}
                <div className="md:col-span-2">
                  <div className="text-xs text-slate-500">Progresso rumo ao número mágico</div>
                  <div className="mt-1 text-3xl font-bold tabular-nums">
                    {new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(progressPct)}%
                  </div>
                  <div className="mt-2"><ProgressBar value={progressPct} /></div>
                  <div
                    className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                      diff < 0
                        ? "bg-amber-50 border-amber-200 text-amber-800"
                        : "bg-emerald-50 border-emerald-200 text-emerald-800"
                    }`}
                  >
                    {diff < 0 ? (
                      <>Faltam {formatCurrency(-diff, "BRL")} para o número mágico</>
                    ) : (
                      <>Você superou a meta em {formatCurrency(diff, "BRL")}.</>
                    )}
                  </div>
                </div>
              </div>
            </Section>

            {/* Cards secundários */}
            <Section>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Patrimônio ao aposentar */}
                <div className="rounded-xl border p-4 min-h-[148px]">
                  <div className="text-xs text-slate-500">Patrimônio ao aposentar</div>
                  <div className="text-2xl font-semibold">{formatCurrency(wealthAtRetire, "BRL")}</div>
                  <div className="text-xs text-slate-600">Horizonte: {Math.round(monthsToRetire / 12)} anos</div>
                </div>

                {/* Cobertura/Perpetuidade + Gasto sustentável */}
                <div
                  className={`rounded-xl border p-4 min-h-[148px] ${
                    hasPerpetuity ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
                  }`}
                >
                  
                                    <div className="text-xs text-slate-600">{hasPerpetuity ? "Perpetuidade" : "Cobertura estimada"}</div>
<div className="mt-1"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--brand-lime)]/10 text-[var(--brand-dark)] border border-[var(--brand-lime)]/40">com gasto de {formatCurrency(monthlySpend, "BRL")}/mês</span></div>
                  <div className="text-2xl font-semibold">
                    {hasPerpetuity ? "Atingível" : (nearPerpetuity ? "Perpetuidade praticamente atingida" : `${runwayYearsLabel} anos`)}
                  </div>
                  <div className="text-xs text-slate-700">
                    {hasPerpetuity ? (
                      <>Com {formatNumber(retireRealReturn, 1)}% real a.a.</>
                    ) : (
                      {nearPerpetuity ? null : <>até ~{endAgeLabel} anos de idade{Number.isFinite(endAge) && endAge > 123 ? " (você terá entrado para o guiness)" : (Number.isFinite(endAge) && endAge > 100 ? " (parabéns para você, caso chegue a essa idade)" : "")}</>}
                    )}
                  </div>
                </div>

                {/* Plano de ação */}
                <div className="rounded-xl border p-4 min-h-[148px]">
                  <div className="text-xs text-slate-500">Plano de ação</div>
                  {gap > 0 ? (
                    <>
                      <div className="text-sm text-slate-700">Poupança extra necessária</div>
                      <div className="text-2xl font-semibold">{formatCurrency(extraMonthlyNeeded, "BRL")}/mês</div>
                      {isFinite(monthsToGoalAtCurrentPlan) && monthsToGoalAtCurrentPlan !== 0 && (
  <div className="text-xs text-slate-600 mt-1">
    Mantendo a poupança atual{lumpSums.length ? " e os aportes" : ""}, meta em ~
    {monthsToGoalAtCurrentPlan > 24
      ? `${formatNumber(monthsToGoalAtCurrentPlan / 12, 1)} anos`
      : `${formatNumber(monthsToGoalAtCurrentPlan, 0)} meses`}{" "}
    (idade ~ {formatNumber(age + monthsToGoalAtCurrentPlan / 12, 1)} anos)
  </div>
)}
                    </>
                  ) : (
                    <div className="text-sm text-emerald-700">Meta atingida com as premissas atuais.</div>
                  )}
                </div>
              </div>
            </Section>

            {/* Gráfico */}
            <Section>
              <p className="font-semibold mb-2">Acumulação até a aposentadoria (valores reais, já ajustados à inflação)</p>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={chartData} margin={{ top: 44, right: 20, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="Meses"
                      ticks={yearTicks}
                      tickFormatter={(m) => {
                        const anos = Math.round(Number(m) / 12);
                        const idade = age + anos;
                        return `${idade} anos`;
                      }}
                    />
                    <YAxis
                      tickFormatter={(v) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v)}
                    />

                    {/* faixa pós-aposentadoria */}
                    {monthsToRetire > 0 && (
                      <ReferenceArea x1={monthsToRetire} x2={monthsTo100} fill="var(--brand-dark)" fillOpacity={0.05} />
                    )}

                    {/* linha pontilhada da aposentadoria */}
                    {monthsToRetire > 0 && (
                      <ReferenceLine
                        x={monthsToRetire}
                        stroke="var(--brand-dark)"
                        strokeDasharray="4 4"
                        label={{ value: `Aposentadoria (${retireAge} anos)`, position: "top", fill: "var(--brand-dark)", fontSize: 12, offset: 14 }}
                      />
                    )}

                    <Legend />
                    <Area type="monotone" dataKey="Patrimônio projetado (real)" stroke="var(--brand-dark)" fill="var(--brand-dark)" strokeWidth={2} fillOpacity={0.15} />
                    <Area type="monotone" dataKey="Meta de aposentadoria (SWR)" stroke="var(--brand-lime)" fill="var(--brand-lime)" strokeWidth={2} fillOpacity={0.12} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Section>

            {/* Como usar */}
            <Section>
              <p className="font-semibold mb-2">Como usar (rápido)</p>
              <ol className="list-decimal pl-5 space-y-1 text-sm text-slate-700">
                <li>
                  Preencha: idade atual, idade de aposentadoria, patrimônio atual, poupança mensal (aceita negativo) e gasto mensal na aposentadoria — <strong>todos em valores reais</strong> (ou seja, <strong>já ajustados pela inflação</strong>).
                </li>
                <li>
                  Ajuste a <strong>SWR</strong> com o slider (referência: <strong>3,5% histórico/realista</strong>; <strong>&gt; 5%</strong> é mais agressivo).
                </li>
                <li>
                  Adicione <strong>contribuições pontuais</strong> (vendas/bônus) informando o valor e o mês em que entram.
                </li>
                <li>
                  Opcional: em <em>Mostrar avançado</em>, ajuste o <strong>retorno real na aposentadoria</strong> para ver por quantos anos o patrimônio cobre o gasto e <strong>até que idade</strong> você tem cobertura.
                </li>
                <li>
                  Veja o <strong>número mágico</strong> (meta por SWR), o <strong>patrimônio ao aposentar</strong>, o <strong>gasto sustentável</strong> e, se faltar, a <strong>poupança extra necessária</strong> e o tempo estimado para atingir a meta.
                </li>
              </ol>
              <p className="text-xs text-slate-500 mt-2">MVP educativo; não é aconselhamento financeiro.</p>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
