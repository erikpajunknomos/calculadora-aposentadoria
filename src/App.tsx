import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Area,
  Legend,
} from "recharts";

// --------------------- Componentes básicos ---------------------
const Section: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="rounded-2xl border border-[var(--brand-gray)] bg-white shadow-sm p-4 sm:p-5 print:border-0 print:shadow-none print:p-0">
    {children}
  </div>
);

const H1: React.FC<React.PropsWithChildren> = ({ children }) => (
  <h1
    className="text-2xl sm:text-3xl font-bold tracking-tight"
    style={{ color: "var(--brand-dark)" }}
  >
    {children}
  </h1>
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

const Slider: React.FC<{
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}> = ({ value, min, max, step, onChange }) => (
  <input
    type="range"
    value={value}
    min={min}
    max={max}
    step={step}
    onChange={(e) => onChange(Number(e.target.value))}
    className="w-full"
  />
);

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

// --------------------- Funções auxiliares ---------------------
const nfBR = new Intl.NumberFormat("pt-BR");
function formatBRInt(n: number) {
  if (!isFinite(n)) return "";
  return nfBR.format(Math.trunc(n));
}
function parseDigits(s: string) {
  return (s || "").replace(/\D+/g, "");
}
function formatCurrency(value: number, code: string = "BRL") {
  if (!isFinite(value)) return "-";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 0,
  }).format(value);
}
function formatNumber(value: number, digits: number = 2) {
  if (!isFinite(value)) return "-";
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: digits,
  }).format(value);
}
function monthlyRateFromRealAnnual(realAnnualPct: number) {
  return Math.pow(1 + realAnnualPct / 100, 1 / 12) - 1;
}
type Lump = { id: number; month: number; amount: number };
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
function targetWealthBySWR({
  annualSpend,
  swrPct,
}: {
  annualSpend: number;
  swrPct: number;
}) {
  return (annualSpend * 100) / swrPct;
}

// --------------------- App ---------------------
export default function App() {
  const themeVars: React.CSSProperties = {
    ["--brand-dark" as any]: "#021e19",
    ["--brand-lime" as any]: "#c8e05b",
    ["--brand-offwhite" as any]: "#f4ece6",
    ["--brand-gray" as any]: "#a6a797",
  };

  const [showAdvanced, setShowAdvanced] = useState(true);
  const [age, setAge] = useState(28);
  const [retireAge, setRetireAge] = useState(35);
  const [currentWealth, setCurrentWealth] = useState(2000000);
  const [monthlySaving, setMonthlySaving] = useState(80000);
  const [swrPct, setSwrPct] = useState(3.5);
  const [accumRealReturn, setAccumRealReturn] = useState(5);
  const [monthlySpend, setMonthlySpend] = useState(60000);

  const monthsToRetire = Math.max(0, (retireAge - age) * 12);
  const monthlyReal = monthlyRateFromRealAnnual(accumRealReturn);

  const accumulation = useMemo(
    () =>
      projectToRetirement({
        currentWealth,
        monthlySaving,
        months: monthsToRetire,
        monthlyRealReturn: monthlyReal,
        lumpSums: [],
      }),
    [currentWealth, monthlySaving, monthsToRetire, monthlyReal]
  );
  const wealthAtRetire =
    accumulation[accumulation.length - 1]?.wealth ?? currentWealth;

  const annualRetireSpend = monthlySpend * 12;
  const targetWealth = targetWealthBySWR({
    annualSpend: annualRetireSpend,
    swrPct,
  });
  const gap = targetWealth - wealthAtRetire;
  const progressPct = Math.max(
    0,
    Math.min(100, (100 * wealthAtRetire) / Math.max(targetWealth, 1))
  );

  const chartData = useMemo(
    () =>
      accumulation.map((row) => ({
        Mês: row.m,
        "Patrimônio projetado (real)": row.wealth,
        "Meta de aposentadoria (SWR)": targetWealth,
      })),
    [accumulation, targetWealth]
  );

  function exportPDF() {
    window.print();
  }

  return (
    <div
      className="min-h-screen w-full p-4 sm:p-8 print:bg-white"
      style={themeVars as React.CSSProperties}
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-3">
            <svg width="120" height="32" viewBox="0 0 120 32" aria-hidden>
              <rect
                x="0"
                y="0"
                width="120"
                height="32"
                rx="6"
                fill="#021e19"
              />
              <text
                x="12"
                y="21"
                fontSize="14"
                fontFamily="Inter, system-ui, sans-serif"
                fill="#c8e05b"
              >
                Nomos Sports
              </text>
            </svg>
            <H1>Calculadora de Aposentadoria para Atletas</H1>
          </div>
          <div className="flex gap-2 flex-wrap items-center print:hidden">
            <Button variant="outline" onClick={exportPDF}>
              Exportar PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Section>
            <p className="font-semibold mb-3">Parâmetros</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Idade atual</Label>
                <BaseInput
                  type="number"
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>Idade de aposentadoria</Label>
                <BaseInput
                  type="number"
                  value={retireAge}
                  onChange={(e) => setRetireAge(Number(e.target.value) || 0)}
                />
              </div>
              <div className="col-span-2">
                <Label>Patrimônio atual (BRL)</Label>
                <BaseInput
                  type="number"
                  value={currentWealth}
                  onChange={(e) =>
                    setCurrentWealth(Number(e.target.value) || 0)
                  }
                />
              </div>
              <div className="col-span-2">
                <Label>Poupança mensal (BRL)</Label>
                <BaseInput
                  type="number"
                  value={monthlySaving}
                  onChange={(e) =>
                    setMonthlySaving(Number(e.target.value) || 0)
                  }
                />
              </div>
              <div className="col-span-2">
                <Label>Gasto mensal na aposentadoria (BRL)</Label>
                <BaseInput
                  type="number"
                  value={monthlySpend}
                  onChange={(e) =>
                    setMonthlySpend(Number(e.target.value) || 0)
                  }
                />
              </div>
            </div>

            <div className="rounded-2xl border p-3 mt-3 space-y-3">
              <div>
                <Label>SWR — Taxa segura de retirada (% a.a.)</Label>
                <div className="mt-2">
                  <Slider
                    value={swrPct}
                    onChange={setSwrPct}
                    min={2.5}
                    max={8}
                    step={0.1}
                  />
                  <div className="text-xs text-slate-500 mt-1">
                    Atual: {formatNumber(swrPct, 1)}%
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={showAdvanced}
                    onChange={setShowAdvanced}
                  />
                  <span className="text-sm">Mostrar avançado</span>
                </div>
              </div>
            </div>
          </Section>

          <div className="lg:col-span-2 space-y-6">
            <Section>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-slate-500">Número mágico (SWR)</p>
                  <p className="text-2xl font-semibold">
                    {formatCurrency(targetWealth, "BRL")}
                  </p>
                  <p className="text-slate-500 text-sm">
                    {formatNumber(swrPct, 1)}% a.a. com gasto de{" "}
                    {formatCurrency(monthlySpend, "BRL")}/mês
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">
                    Patrimônio ao aposentar
                  </p>
                  <p className="text-2xl font-semibold">
                    {formatCurrency(wealthAtRetire, "BRL")}
                  </p>
                  <p className="text-slate-500 text-sm">
                    Horizonte: {Math.round(monthsToRetire / 12)} anos
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Status</p>
                  <p
                    className={`text-sm ${
                      gap > 0 ? "text-slate-700" : "text-emerald-700"
                    }`}
                  >
                    {gap > 0
                      ? `Faltam ${formatCurrency(gap, "BRL")} para a meta`
                      : "Meta de perpetuidade atingida"}
                  </p>
                  <p className="text-slate-500 text-xs mt-1">
                    Progresso: {formatNumber(progressPct, 0)}%
                  </p>
                </div>
              </div>
            </Section>

            <Section>
              <p className="font-semibold mb-2">
                Acumulação até a aposentadoria (valores reais)
              </p>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart
                    data={chartData}
                    margin={{ top: 10, right: 20, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="Mês" tickFormatter={(v) => `${v}m`} />
                    <YAxis
                      tickFormatter={(v) =>
                        new Intl.NumberFormat("pt-BR", {
                          notation: "compact",
                          maximumFractionDigits: 1,
                        }).format(v)
                      }
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="Patrimônio projetado (real)"
                      stroke="var(--brand-dark)"
                      fill="var(--brand-dark)"
                      strokeWidth={2}
                      fillOpacity={0.15}
                    />
                    <Area
                      type="monotone"
                      dataKey="Meta de aposentadoria (SWR)"
                      stroke="var(--brand-lime)"
                      fill="var(--brand-lime)"
                      strokeWidth={2}
                      fillOpacity={0.12}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

