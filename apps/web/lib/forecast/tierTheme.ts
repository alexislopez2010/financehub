/**
 * Single source of truth for the three-tier color coding — used by the chart
 * series, the tier chips, and section accents so the colors never drift.
 */

import type { SpendTier } from './tier'

export interface TierTheme {
  label: string
  /** Tailwind text color for labels/accents. */
  text: string
  /** Tailwind background for chips / swatches. */
  fill: string
  /** Tailwind soft background for section tint. */
  softBg: string
  /** Hex for SVG chart series. */
  hex: string
}

export const TIER_THEME: Record<SpendTier, TierTheme> = {
  essential:     { label: 'Essential',                text: 'text-blue-700',  fill: 'bg-blue-500',  softBg: 'bg-blue-50',  hex: '#3b82f6' },
  services:      { label: 'Services & Subscriptions', text: 'text-amber-700', fill: 'bg-amber-500', softBg: 'bg-amber-50', hex: '#f59e0b' },
  discretionary: { label: 'Discretionary',            text: 'text-slate-700', fill: 'bg-slate-500', softBg: 'bg-slate-100', hex: '#64748b' }
}

/** Render order: essential floor first, discretionary last. */
export const TIER_ORDER: ReadonlyArray<SpendTier> = ['essential', 'services', 'discretionary']
