import React, { useMemo, useEffect } from 'react';
import { useData } from '../hooks/useData';
import { useFilters } from '../hooks/useFilters';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Label } from '../components/ui/label';
import { formatCurrency, formatShortDate } from '../utils/helpers';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import {
  getMonthWindow,
  getYearWindow,
  getPreviousWindow,
  txInWindow,
  aggregateTransactions,
  computeDeltas,
  buildCategoryArray,
  Window
} from '../utils/analytics';
import { Transaction, Budget } from '../types';

interface DashboardProps {
  onCategorySelect: (categoryId: string, startDate?: string, endDate?: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onCategorySelect }) => {
  const { transactions, categories, budgets } = useData();
  const { dashboardFilters, setDashboardFilters } = useFilters();
  const { periodType, selectedMonth, selectedYear, selectedCategory, comparePrevious } = dashboardFilters;

  const setPeriodType = (val: 'all' | 'month' | 'year') => setDashboardFilters(prev => ({ ...prev, periodType: val }));
  const setSelectedMonth = (val: string | null) => setDashboardFilters(prev => ({ ...prev, selectedMonth: val }));
  const setSelectedYear = (val: string | null) => setDashboardFilters(prev => ({ ...prev, selectedYear: val }));
  const setSelectedCategory = (val: string) => setDashboardFilters(prev => ({ ...prev, selectedCategory: val }));
  const setComparePrevious = (val: boolean | ((p: boolean) => boolean)) => setDashboardFilters(prev => ({ ...prev, comparePrevious: typeof val === 'function' ? val(prev.comparePrevious) : val }));

  // Populate month/year options from transactions
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => {
      const key = t.date.substring(0, 7); // YYYY-MM
      set.add(key);
    });
    return Array.from(set).sort().reverse();
  }, [transactions]);

  const availableYears = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => {
      const key = t.date.substring(0, 4);
      set.add(key);
    });
    return Array.from(set).sort().reverse();
  }, [transactions]);

  // Build windows based on selection
  const currentWindow: Window | null = useMemo(() => {
    try {
      if (periodType === 'month' && selectedMonth) return getMonthWindow(selectedMonth);
      if (periodType === 'year' && selectedYear) return getYearWindow(selectedYear);
      return null;
    } catch {
      return null;
    }
  }, [periodType, selectedMonth, selectedYear]);

  const previousWindow: Window | null = useMemo(() => {
    if (!currentWindow || !comparePrevious) return null;
    return getPreviousWindow(currentWindow);
  }, [currentWindow, comparePrevious]);

  // Filtered transactions for current and previous windows
  const txCurrent = useMemo(() => {
    // When viewing "All", use the full transactions list
    if (periodType === 'all') return transactions;
    if (!currentWindow) return [] as Transaction[];
    return transactions.filter(t => txInWindow(t, currentWindow));
  }, [transactions, currentWindow, periodType]);

  const txPrevious = useMemo(() => {
    if (!previousWindow) return [] as Transaction[];
    return transactions.filter(t => txInWindow(t, previousWindow));
  }, [transactions, previousWindow]);

  // Aggregates
  // Derive filtered transaction sets that combine period + category so all charts use the same source of truth
  const txCurrentFiltered = useMemo(() => {
    if (!txCurrent) return [] as Transaction[];
    if (!selectedCategory) return txCurrent;
    return txCurrent.filter(t => t.categoryId === selectedCategory);
  }, [txCurrent, selectedCategory]);

  const txPreviousFiltered = useMemo(() => {
    if (!txPrevious) return [] as Transaction[];
    if (!selectedCategory) return txPrevious;
    return txPrevious.filter(t => t.categoryId === selectedCategory);
  }, [txPrevious, selectedCategory]);

  const aggregatesCurrent = useMemo(() => aggregateTransactions(txCurrentFiltered, undefined), [txCurrentFiltered]);
  const aggregatesPrevious = useMemo(() => previousWindow ? aggregateTransactions(txPreviousFiltered, undefined) : { income: 0, expenses: 0, net: 0, byCategory: {}, totalAbsoluteExpenses: 0 }, [txPreviousFiltered, previousWindow]);

  const deltas = useMemo(() => computeDeltas(aggregatesCurrent, aggregatesPrevious), [aggregatesCurrent, aggregatesPrevious]);

  // Category chart data for current window (round values to 2 decimals for display)
  // If the "All" period produces no category data (e.g. due to upstream filtering),
  // fall back to aggregating across the full transactions set so the chart still shows something.
  const categoryChartData = useMemo(() => {
    const base = buildCategoryArray(aggregatesCurrent.byCategory, categories).map(c => ({
      ...c,
      value: Math.round((c.value + Number.EPSILON) * 100) / 100
    }));

    if (periodType === 'all' && base.length === 0) {
      // Fallback: aggregate over all transactions (respect selectedCategory if set)
      const fallbackAgg = aggregateTransactions(transactions, selectedCategory || undefined);
      return buildCategoryArray(fallbackAgg.byCategory, categories).map(c => ({
        ...c,
        value: Math.round((c.value + Number.EPSILON) * 100) / 100
      }));
    }

    return base;
  }, [aggregatesCurrent, categories, periodType, transactions, selectedCategory]);

  const budgetChartData = useMemo(() => {
    const income = aggregatesCurrent.income;
    if (income === 0) return [];

    const data = budgets
      .map(budget => {
        const category = categories.find(c => c.id === budget.categoryId);
        if (!category || category.name === 'Income') return null;

        const spentAbs = aggregatesCurrent.byCategory[budget.categoryId] || 0;
        const spent = (spentAbs / income) * 100;

        const min = budget.recommendedMinPercent ?? 0;
        const max = budget.recommendedMaxPercent ?? 0;
        const range = Math.max(max - min, 0);

        // Determine status color for the spent marker
        let color = '#10b981'; // within range (green)
        if (spent < min) color = '#3b82f6'; // under (blue)
        if (max > 0 && spent > max) color = '#ef4444'; // over (red)

        return {
          name: category.name,
          spent,
          min,
          max,
          range,
          color,
        };
      })
      .filter(Boolean) as { name: string; spent: number; min: number; max: number; range: number; color: string }[];

    // Sort by ratio of spent to max budget (highest ratio first)
    return data.sort((a, b) => {
      const ratioA = a.max > 0 ? a.spent / a.max : 0;
      const ratioB = b.max > 0 ? b.spent / b.max : 0;
      return ratioB - ratioA;
    });
  }, [aggregatesCurrent, budgets, categories]);


  // Time series for context:
  // If viewing a year: show monthly totals for that year
  // If viewing a month: show weekly totals for the selected month
  const timeSeries = useMemo(() => {
    const map: Record<string, { income: number; expenses: number }> = {};
    const buckets: string[] = []; // ordered bucket keys

    // If viewing All -> produce an all-time monthly series (months present in data)
    if (periodType === 'all') {
      const source = (txCurrentFiltered && txCurrentFiltered.length > 0) ? txCurrentFiltered : transactions;
      const monthsSet = new Set<string>();
      source.forEach(t => monthsSet.add(t.date.substring(0, 7)));
      
      const months = Array.from(monthsSet).sort();
      months.forEach(m => {
        buckets.push(m);
        map[m] = { income: 0, expenses: 0 };
      });

      source.forEach(t => {
        const monthKey = t.date.substring(0, 7);
        if (monthKey in map) {
          if (t.amount > 0) map[monthKey].income += t.amount;
          else map[monthKey].expenses += Math.abs(t.amount);
        }
      });

      return buckets.map(k => ({
        name: formatShortDate(new Date(`${k}-02`)),
        Income: Math.round(map[k].income * 100) / 100,
        Expenses: Math.round(map[k].expenses * 100) / 100,
        Net: Math.round((map[k].income - map[k].expenses) * 100) / 100
      }));
    }

    if (!currentWindow) return [];

    if (periodType === 'year' && selectedYear) {
      for (let m = 1; m <= 12; m++) {
        const key = `${selectedYear}-${String(m).padStart(2, '0')}`;
        buckets.push(key);
        map[key] = { income: 0, expenses: 0 };
      }
    } else if (periodType === 'month' && selectedMonth) {
      const [yStr, mStr] = selectedMonth.split('-');
      const y = Number(yStr);
      const m = Number(mStr);
      const monthStart = new Date(Date.UTC(y, m - 1, 1));
      const nextMonthStart = new Date(Date.UTC(y, m - 1 + 1, 1));
      const monthEnd = new Date(nextMonthStart.getTime() - 1);

      let cursor = new Date(monthStart.getTime());
      while (cursor.getTime() <= monthEnd.getTime()) {
        const key = cursor.toISOString().substring(0, 10);
        buckets.push(key);
        map[key] = { income: 0, expenses: 0 };
        cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
    }

    txCurrentFiltered.forEach(t => {
      const txDateUTC = new Date(t.date);
      const txDateKey = txDateUTC.toISOString().substring(0, 10);

      let targetKey: string | null = null;
      if (periodType === 'year' && selectedYear) {
        targetKey = t.date.substring(0, 7);
      } else if (periodType === 'month' && selectedMonth) {
        for (let i = buckets.length - 1; i >= 0; i--) {
          if (buckets[i] <= txDateKey) {
            targetKey = buckets[i];
            break;
          }
        }
      }

      if (targetKey && targetKey in map) {
        if (t.amount > 0) map[targetKey].income += t.amount;
        else map[targetKey].expenses += Math.abs(t.amount);
      }
    });

    return buckets.map(k => {
      let label = '';
      if (periodType === 'year') {
        label = formatShortDate(new Date(`${k}-02`));
      } else {
        const d = new Date(k + 'T00:00:00Z');
        label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      }
      return {
        name: label,
        Income: Math.round(map[k].income * 100) / 100,
        Expenses: Math.round(map[k].expenses * 100) / 100,
        Net: Math.round((map[k].income - map[k].expenses) * 100) / 100
      };
    });
  }, [currentWindow, periodType, selectedMonth, selectedYear, txCurrentFiltered, transactions]);

  // Small helpers for display labels
  const periodLabel = useMemo(() => {
    if (!currentWindow) return 'All time';
    if (periodType === 'month' && selectedMonth) {
      const d = new Date(`${selectedMonth}-02`);
      return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    }
    if (periodType === 'year' && selectedYear) {
      return selectedYear;
    }
    return 'Selected period';
  }, [currentWindow, periodType, selectedMonth, selectedYear]);

  // UI rendering
  if (transactions.length === 0) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-semibold text-gray-700">Welcome to Local Finance</h2>
        <p className="mt-2 text-gray-500">Get started by uploading your transaction data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter row */}
      <div className="flex flex-col md:flex-row md:items-end gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Period</Label>
          <div className="flex items-center bg-gray-100 p-1 rounded-md">
            <Button
              variant={periodType === 'all' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-4 text-xs"
              onClick={() => setPeriodType('all')}
            >
              All
            </Button>
            <Button
              variant={periodType === 'month' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-4 text-xs"
              onClick={() => setPeriodType('month')}
            >
              Month
            </Button>
            <Button
              variant={periodType === 'year' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-4 text-xs"
              onClick={() => setPeriodType('year')}
            >
              Year
            </Button>
          </div>
        </div>

        {periodType === 'month' && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Month</Label>
            <Select value={selectedMonth || ''} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px] h-10">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map(m => (
                  <SelectItem key={m} value={m}>
                    {new Date(`${m}-02`).toLocaleString(undefined, { month: 'long', year: 'numeric' })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {periodType === 'year' && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Year</Label>
            <Select value={selectedYear || ''} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[120px] h-10">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(y => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Category</Label>
          <Select value={selectedCategory || "all"} onValueChange={(val) => setSelectedCategory(val === "all" ? "" : val)}>
            <SelectTrigger className="w-[200px] h-10">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {periodType !== 'all' && (
          <div className="flex items-center gap-2 mb-2">
            <input 
              id="compare" 
              type="checkbox" 
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              checked={comparePrevious} 
              onChange={e => setComparePrevious(e.target.checked)} 
            />
            <Label htmlFor="compare" className="text-sm font-normal cursor-pointer">Compare Previous</Label>
          </div>
        )}

        <div className="md:ml-auto flex items-end mb-1">
          <Button 
            variant="outline" 
            size="sm"
            className="h-9 text-xs"
            onClick={() => { 
              setDashboardFilters({
                periodType: 'year',
                selectedMonth: availableMonths[0] || null,
                selectedYear: availableYears[0] || null,
                selectedCategory: '',
                comparePrevious: false
              });
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <h3 className="text-sm font-medium text-muted-foreground">Total Income ({periodLabel})</h3>
            <p className="mt-1 text-3xl font-semibold text-green-600">{formatCurrency(aggregatesCurrent.income)}</p>
            {previousWindow && (
              <p className="text-xs text-muted-foreground mt-1">
                {deltas.delta.income >= 0 ? '+' : ''}{formatCurrency(deltas.delta.income)} {deltas.pct.income !== null ? `(${deltas.pct.income!.toFixed(1)}%)` : ''}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <h3 className="text-sm font-medium text-muted-foreground">Total Expenses ({periodLabel})</h3>
            <p className="mt-1 text-3xl font-semibold text-red-600">{formatCurrency(aggregatesCurrent.totalAbsoluteExpenses)}</p>
            {previousWindow && (
              <p className="text-xs text-muted-foreground mt-1">
                {deltas.delta.expenses >= 0 ? '+' : ''}{formatCurrency(deltas.delta.expenses)} {deltas.pct.expenses !== null ? `(${deltas.pct.expenses!.toFixed(1)}%)` : ''}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <h3 className="text-sm font-medium text-muted-foreground">Net ({periodLabel})</h3>
            <p className={`mt-1 text-3xl font-semibold ${aggregatesCurrent.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
              {formatCurrency(aggregatesCurrent.net)}
            </p>
            {previousWindow && (
              <p className="text-xs text-muted-foreground mt-1">
                {deltas.delta.net >= 0 ? '+' : ''}{formatCurrency(deltas.delta.net)} {deltas.pct.net !== null ? `(${deltas.pct.net!.toFixed(1)}%)` : ''}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-foreground">Spending by Category</h3>
              <span className="text-sm text-muted-foreground">{periodLabel}</span>
            </div>
            {categoryChartData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No expenses for the selected filters.</div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(300, categoryChartData.length * 40)}>
                <BarChart
                  data={categoryChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  />
                  <Bar
                    dataKey="value"
                    radius={[0, 4, 4, 0]}
                    onClick={(data) => {
                      const categoryId = data.id;
                      try { setSelectedCategory(categoryId); } catch {}
                      if (typeof onCategorySelect === 'function') {
                        const startStr = currentWindow?.start ? currentWindow.start.toISOString().substring(0,10) : undefined;
                        const endStr = currentWindow?.end ? currentWindow.end.toISOString().substring(0,10) : undefined;
                        onCategorySelect(categoryId, startStr, endStr);
                      }
                    }}
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} className="cursor-pointer hover:opacity-80 transition-opacity" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-foreground">Budget Performance</h3>
              <span className="text-sm text-muted-foreground">{periodLabel}</span>
            </div>
            {budgetChartData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No budget data for the selected period.</div>
            ) : (
              <div className="space-y-5">
                {budgetChartData.map((b) => {
                  const income = aggregatesCurrent.income;
                  const spentAmount = (b.spent / 100) * income;
                  const targetMinAmount = (b.min / 100) * income;
                  const targetMaxAmount = (b.max / 100) * income;
                  const totalScale = Math.max(b.spent, b.max, 0.01); // Avoid division by zero
                  const spendToBudgetPct = b.max > 0 ? (b.spent / b.max) * 100 : 0;
                  
                  return (
                    <div key={b.name} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{b.name}</span>
                        <div className="text-right">
                          <span className={`font-bold ${spendToBudgetPct > 100 ? 'text-red-600' : 'text-green-600'}`}>
                            {spendToBudgetPct.toFixed(0)}%
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({formatCurrency(spentAmount)} / {formatCurrency(targetMaxAmount)})
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="relative h-4 flex-1 bg-gray-100 rounded-full overflow-hidden">
                          {/* Target range background */}
                          <div 
                            className="absolute h-full bg-green-100 opacity-50"
                            style={{ 
                              left: `${(b.min / totalScale) * 100}%`,
                              width: `${((b.max - b.min) / totalScale) * 100}%`
                            }}
                          />
                          {/* Actual spend bar */}
                          <div 
                            className="absolute h-full transition-all duration-500"
                            style={{ 
                              width: `${Math.min(100, (b.spent / totalScale) * 100)}%`,
                              backgroundColor: b.color 
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{b.spent.toFixed(1)}% of income</span>
                        <span>Target: {b.min}-{b.max}%</span>
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2 flex items-center gap-4 text-[10px] text-muted-foreground border-t">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-[#10b981]" /> Within
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-[#3b82f6]" /> Under
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-[#ef4444]" /> Over
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-4 sm:p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-foreground">Income vs. Expenses</h3>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-green-500 rounded-sm" />
                  <span>Income</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-red-500 rounded-sm" />
                  <span>Expenses</span>
                </div>
              </div>
            </div>
            {timeSeries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No data for trend.</div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={timeSeries} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#666' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#666' }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
                            <p className="font-bold mb-2 border-bottom pb-1">{label}</p>
                            <div className="space-y-1">
                              <p className="flex justify-between gap-4">
                                <span className="text-green-600">Income:</span>
                                <span className="font-mono">{formatCurrency(data.Income)}</span>
                              </p>
                              <p className="flex justify-between gap-4">
                                <span className="text-red-600">Expenses:</span>
                                <span className="font-mono">{formatCurrency(data.Expenses)}</span>
                              </p>
                              <div className="pt-1 mt-1 border-t flex justify-between gap-4 font-bold">
                                <span>Net:</span>
                                <span className={data.Net >= 0 ? 'text-blue-600' : 'text-orange-600'}>
                                  {formatCurrency(data.Net)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
