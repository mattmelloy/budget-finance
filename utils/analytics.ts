import { Transaction, Category } from '../types';

/**
 * Date window helpers and aggregation utilities for dashboard analytics.
 *
 * - Dates are expected to be ISO-like strings (YYYY-MM-DD or full ISO).
 * - Month keys are "YYYY-MM".
 * - Year keys are "YYYY".
 */

export type Window = { start: Date; end: Date };

/** Return a window covering the whole month for YYYY-MM (e.g. "2025-03") */
export const getMonthWindow = (ym: string): Window => {
  const [yStr, mStr] = ym.split('-');
  const y = Number(yStr);
  const m = Number(mStr); // 1-12
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  // next month first day minus 1ms
  const next = new Date(Date.UTC(y, m - 1 + 1, 1, 0, 0, 0));
  const end = new Date(next.getTime() - 1);
  return { start, end };
};

/** Return a window covering the whole year for "YYYY" */
export const getYearWindow = (yStr: string): Window => {
  const y = Number(yStr);
  const start = new Date(Date.UTC(y, 0, 1, 0, 0, 0));
  const next = new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0));
  const end = new Date(next.getTime() - 1);
  return { start, end };
};

/** Given a window, return the previous window of same duration (month -> previous month, year -> previous year) */
export const getPreviousWindow = (w: Window): Window => {
  const duration = w.end.getTime() - w.start.getTime() + 1;
  const prevEnd = new Date(w.start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - duration + 1);
  return { start: prevStart, end: prevEnd };
};

/** Helper: parse transaction date into a Date (UTC-safe) */
const parseTxDate = (t: Transaction): Date => {
  // Use Date constructor; transactions use ISO-ish strings
  const d = new Date(t.date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
};

/** Check if transaction date is inside window (inclusive) */
export const txInWindow = (t: Transaction, w: Window): boolean => {
  const d = parseTxDate(t).getTime();
  return d >= w.start.getTime() && d <= w.end.getTime();
};

export interface Aggregates {
  income: number;
  expenses: number; // negative sum of expenses (e.g., -1234.56)
  net: number;
  byCategory: Record<string, number>; // absolute expense amounts per category (positive numbers)
  totalAbsoluteExpenses: number; // absolute value of expenses
}

/** Compute aggregates for a set of transactions (optionally filtered by categoryId) */
export const aggregateTransactions = (transactions: Transaction[], categoryId?: string | null): Aggregates => {
  let income = 0;
  let expenses = 0;
  const byCategory: Record<string, number> = {};

  transactions.forEach(t => {
    if (categoryId && categoryId !== '' && t.categoryId !== categoryId) return;
    if (t.amount > 0) income += t.amount;
    if (t.amount < 0) {
      expenses += t.amount; // negative
      const cat = t.categoryId || 'cat-uncategorized';
      if (!byCategory[cat]) byCategory[cat] = 0;
      byCategory[cat] += Math.abs(t.amount);
    }
  });

  const net = income + expenses;
  const totalAbsoluteExpenses = Math.abs(expenses);
  return { income, expenses, net, byCategory, totalAbsoluteExpenses };
};

/** Compute deltas between current and previous aggregates */
export const computeDeltas = (current: Aggregates, previous: Aggregates) => {
  const delta = {
    income: current.income - previous.income,
    expenses: current.totalAbsoluteExpenses - previous.totalAbsoluteExpenses,
    net: current.net - previous.net
  };

  const pct = {
    income: previous.income ? (delta.income / Math.abs(previous.income)) * 100 : null,
    expenses: previous.totalAbsoluteExpenses ? (delta.expenses / previous.totalAbsoluteExpenses) * 100 : null,
    net: previous.net ? (delta.net / Math.abs(previous.net)) * 100 : null
  };

  return { delta, pct };
};

/** Build by-category array sorted descending for charting; categories map provides names/colors */
export const buildCategoryArray = (byCategory: Record<string, number>, categories: Category[]) => {
  const catMap = categories.reduce<Record<string, Category>>((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, {});
  return Object.keys(byCategory).map(id => ({
    id,
    name: catMap[id]?.name || (id === 'cat-uncategorized' ? 'Uncategorized' : id),
    value: byCategory[id],
    color: catMap[id]?.color || '#888'
  })).sort((a, b) => b.value - a.value);
};
