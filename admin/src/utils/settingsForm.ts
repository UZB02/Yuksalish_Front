import type { DailyAggregation, ScoringSettings } from '@/api/types'

export type SettingKey = keyof ScoringSettings
export const SETTING_KEYS: SettingKey[] = [
  'minScore',
  'maxScore',
  'requireBehaviorType',
  'commentRequiredBelow',
  'editWindowHours',
  'backdateDays',
  'dailyAggregation',
]

export type SettingErrors = Partial<Record<SettingKey, string>>
type Translate = (key: string, params?: Record<string, unknown>) => string

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n)

/** Sozlamalar formasi validatsiyasi (xato matnlari i18n orqali). */
export function validateScoringSettings(v: ScoringSettings, t: Translate): SettingErrors {
  const e: SettingErrors = {}
  if (!isInt(v.minScore) || v.minScore < 0) e.minScore = t('settings.errors.nonNegativeInt')
  if (!isInt(v.maxScore) || v.maxScore < 0) e.maxScore = t('settings.errors.nonNegativeInt')
  if (!e.minScore && !e.maxScore && v.minScore >= v.maxScore) {
    e.maxScore = t('settings.errors.maxGtMin')
  }
  if (v.commentRequiredBelow !== null) {
    if (!isInt(v.commentRequiredBelow)) e.commentRequiredBelow = t('settings.errors.integer')
    else if (
      !e.minScore &&
      !e.maxScore &&
      (v.commentRequiredBelow <= v.minScore || v.commentRequiredBelow > v.maxScore)
    ) {
      e.commentRequiredBelow = t('settings.errors.thresholdRange', {
        min: v.minScore,
        max: v.maxScore,
      })
    }
  }
  if (!isInt(v.editWindowHours) || v.editWindowHours < 0) {
    e.editWindowHours = t('settings.errors.nonNegativeInt')
  }
  if (!isInt(v.backdateDays) || v.backdateDays < 0) {
    e.backdateDays = t('settings.errors.nonNegativeInt')
  }
  if (!['average', 'min', 'last'].includes(v.dailyAggregation as DailyAggregation)) {
    e.dailyAggregation = t('validation.required')
  }
  return e
}

import {
  diffValues,
  flagsFromOverride,
  mergeValues,
  pickOverride,
  resetFlagValue,
} from './scopeSettings'

/** O'zgargan kalitlar. */
export const diffSettings = (before: ScoringSettings, after: ScoringSettings): SettingKey[] =>
  diffValues(before, after, SETTING_KEYS)

export const overrideFlags = (override: Partial<ScoringSettings> | null) =>
  flagsFromOverride<ScoringSettings, SettingKey>(override, SETTING_KEYS)

export const mergeWithGlobal = (
  global: ScoringSettings,
  override: Partial<ScoringSettings> | null,
): ScoringSettings => mergeValues(global, override)

export const buildOverride = (values: ScoringSettings, flags: Record<SettingKey, boolean>) =>
  pickOverride(values, flags, SETTING_KEYS)

export const applyFlagChange = (
  values: ScoringSettings,
  global: ScoringSettings,
  key: SettingKey,
  on: boolean,
) => resetFlagValue(values, global, key, on)
