import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Area,
  Legend,
} from "recharts";

// ---------- UI Helpers ----------
const Section: React.FC<React.PropsWithChildren<{ className?: string }>> = ({
  children,
  className,
}) => (
  <div
    className={`rounded-2xl border border-[var(--brand-gray)] bg-white shadow-sm p-4 sm:p-5 ${className}`}
  >
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

const BaseInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm text-right tabular-nums tracking-tight outline-none focus:ring-2 focus:ring-[var(--brand-lime)] ${
      props.className || ""
    }`}
  />
);

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

const Slider = ({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}) => (
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

const Switch = ({ checked, onChange }: { checked: boolean; onChange: (b: boolean) => void }) => (
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

// ---------- Utils ----------
const nfBR = new Intl.NumberFormat("pt-BR");
const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const formatNumber = (v: number, d = 2) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: d }).format(v);
const monthlyRateFromRealAnnual = (r: number) => Math.pow(1 + r / 100, 1 / 12) - 1;
const targetWealthBySWR = (annualSpend: number, swrPct: number) => (annualSpend * 100) / swrPct;

type Lump = { id: number; month: number; amount: number };
const projectToRetirement = (
  currentWealth: number,
  monthlySaving: number,
  months: number,
  monthlyRealReturn: number,
  lumps: Lump[]
) => {
  const rows: { m: number; wealth: number }[] = [];
  let W = currentWealth;
  const byMonth = new Map<number, number>();
  for (const ls of lumps) byMonth.set(ls.month, (byMonth.get(ls.month) || 0) + ls.amount);
  for (let t = 0; t <= months; t++) {
    rows.push({ m: t, wealth: W });
    W = W * (1 + monthlyRealReturn) + monthlySaving + (byMonth.get(t + 1) || 0);
  }
  return rows;
};

// ---------- App ----------
export default function App() {
  const themeVars: React.CSSProperties = {
    ["--brand-dark" as any]: "#021e19",
    ["--brand-lime" as any]: "#c8e05b",
    ["--brand-offwhite" as any]: "#f4ece6",
    ["--brand-gray" as any]: "#a6a797",
  };

  const [age, setAge] = useState(28);
  const [retireAge, setRetireAge] = useState(35);
  const [currentWealth, setCurrentWealth] = useState(2000000);
  const [monthlySaving, setMonthlySaving] = useState(80000);
  const [monthlySpend, setMonthlySpend] = useState(60000);
  const [swrPct, setSwrPct] = useState(3.5);
  const [accumRealReturn, setAccumRealReturn] = useState(5);
  const [retireRealReturn, setRetireRealReturn] = useState(3);
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [lumps, setLumps] = useState<Lump[]>([]);

  const monthsToRetire = Math.max(0, (retireAge - age) * 12);
  const monthlyReal = monthlyRateFromRealAnnual(accumRealReturn);

  const accumulation = useMemo(
    () => projectToRetirement(currentWealth, monthlySaving, monthsToRetire, monthlyReal, lumps),
    [currentWealth, monthlySaving, monthsToRetire, monthlyReal, lumps]
  );
  const wealthAtRetire = accumulation.at(-1)?.wealth ?? currentWealth;

  const annualSpend = monthlySpend * 12;
  const targetWealth = targetWealthBySWR(annualSpend, swrPct);
  const gap = targetWealth - wealthAtRetire;
  const progress = Math.max(0, Math.min(100, (wealthAtRetire / targetWealth) * 100));

  const sustainableSpend = (wealthAtRetire * retireRealReturn) / 100 / 12;
  const extraSaving = gap > 0 ? gap / monthsToRetire : 0;

  const chartData = accumulation.map((row) => ({
    Mês: row.m,
    "Patrimônio projetado (real)": row.wealth,
    "Meta de aposentadoria (SWR)": targetWealth,
  }));

  return (
    <div
      className="min-h-screen w-full p-4 sm:p-8"
      style={{ ...themeVars, backgroundColor: "var(--brand-offwhite)" }}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-[var(--brand-dark)] text-[var(--brand-lime)] px-3 py-1 rounded-md font-semibold">
              Nomos Sports
            </div>
            <H1>Calculadora de Aposentadoria para Atletas</H1>
          </div>
          <Button variant="outline" onClick={() => window.print()}>
            Exportar PDF
          </Button>
        </div>

        {/* Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Inputs */}
          <Section>
            <p className="font-semibold mb-3">Parâmetros</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Idade atual</Label>
                <BaseInput type="number" value={age} onChange={(e) => setAge(+e.target.value)} />
              </div>
              <div>
                <Label>Idade de aposentadoria</Label>
                <BaseInput type="number" value={retireAge} onChange={(e) => setRetireAge(+e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>Patrimônio atual (BRL)</Label>
                <BaseInput type="number" value={currentWealth} onChange={(e) => setCurrentWealth(+e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>Poupança mensal (BRL)</Label>
                <BaseInput type="number" value={monthlySaving} onChange={(e) => setMonthlySaving(+e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>Gasto mensal na aposentadoria (BRL)</Label>
                <BaseInput type="number" value={monthlySpend} onChange={(e) => setMonthlySpend(+e.target.value)} />
              </div>
            </div>

            <div className="rounded-2xl border p-3 mt-3 space-y-3">
              <div>
                <Label>SWR — Taxa segura de retirada (% a.a.)</Label>
                <Slider value={swrPct} onChange={setSwrPct} min={2.5} max={8} step={0.1} />
                <div className="text-xs text-slate-500">Atual: {formatNumber(swrPct, 1)}%</div>
              </div>
              <div>
                <Label>Retorno real na acumulação (% a.a.)</Label>
                <BaseInput type="number" value={accumRealReturn} onChange={(e) => setAccumRealReturn(+e.target.value)} />
              </div>
              {showAdvanced && (
                <div>
                  <Label>Retorno real na aposentadoria (% a.a.)</Label>
                  <BaseInput type="number" value={retireRealReturn} onChange={(e) => setRetireRealReturn(+e.target.value)} />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch checked={showAdvanced} onChange={setShowAdvanced} />
                <span className="text-sm">Mostrar avançado</span>
              </div>
            </div>
          </Section>

          {/* Results */}
          <div className="lg:col-span-2 space-y-6">
            <Section>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-slate-500">Número mágico (SWR)</p>
                  <p className="text-2xl font-semibold">{formatCurrency(targetWealth)}</p>
                  <p className="text-slate-500 text-sm">
                    {formatNumber(swrPct, 1)}% a.a. com gasto de {formatCurrency(monthlySpend)}/mês
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Patrimônio ao aposentar</p>
                  <p className="text-2xl font-semibold">{formatCurrency(wealthAtRetire)}</p>
                  <p className="text-slate-500 text-sm">Horizonte: {Math.round(monthsToRetire / 12)} anos</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Status</p>
                  <p className={gap > 0 ? "text-sm text-slate-700" : "text-sm text-emerald-700"}>
                    {gap > 0 ? `Faltam ${formatCurrency(gap)} para a meta` : "Meta atingida"}
                  </p>
                  <p className="text-slate-500 text-xs">Progresso: {formatNumber(progress, 0)}%</p>
                  <p className="text-slate-500 text-xs">
                    Gasto sustentável: {formatCurrency(sustainableSpend)}
                  </p>
                  {gap > 0 && (
                    <p className="text-slate-500 text-xs">
                      Poupança extra necessária: {formatCurrency(extraSaving)}/mês
                    </p>
                  )}
                </div>
              </div>
            </Section>

            <Section>
              <p className="font-semibold mb-2">Acumulação até a aposentadoria (valores reais)</p>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="Mês" tickFormatter={(v) => `${v}m`} />
                    <YAxis tickFormatter={(v) => formatNumber(v, 0)} />
                    <Legend />
                    <Area dataKey="Patrimônio projetado (real)" stroke="var(--brand-dark)" fill="var(--brand-dark)" strokeWidth={2} fillOpacity={0.15} />
                    <Area dataKey="Meta de aposentadoria (SWR)" stroke="var(--brand-lime)" fill="var(--brand-lime)" strokeWidth={2} fillOpacity={0.12} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Section>

            <Section>
              <p className="font-semibold mb-2">Como usar (rápido)</p>
              <ol className="list-decimal list-inside space-y-1 text-sm text-slate-700">
                <li>Preencha: idade atual, idade de aposentadoria, patrimônio atual, poupança mensal e gasto mensal.</li>
                <li>Ajuste a SWR no slider; veja o valor alvo.</li>
                <li>Adicione contribuições pontuais (bônus/vendas) se quiser.</li>
                <li>Opcional: em Mostrar avançado, ajuste o retorno real na aposentadoria.</li>
                <li>Veja o número mágico, patrimônio ao aposentar, gasto sustentável, poupança extra necessária e tempo estimado.</li>
              </ol>
              <p className="text-xs text-slate-500 mt-2">MVP educativo; não é aconselhamento financeiro.</p>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
