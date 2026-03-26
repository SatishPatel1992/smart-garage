export type ReportDatePreset = 'thisMonth' | 'lastMonth' | 'last6Months' | 'financialYear';
export type PaymentMethodPref = 'cash' | 'upi' | 'card' | 'bank_transfer';

export type AppPreferences = {
  reportDefaultPreset: ReportDatePreset;
  paymentDefaultMethod: PaymentMethodPref;
  estimateIncludeGSTByDefault: boolean;
};

const PREF_KEY = 'smart_garage_app_preferences_v1';

const DEFAULT_PREFS: AppPreferences = {
  reportDefaultPreset: 'last6Months',
  paymentDefaultMethod: 'cash',
  estimateIncludeGSTByDefault: true,
};

export function getAppPreferences(): AppPreferences {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<AppPreferences>;
    return {
      reportDefaultPreset:
        parsed.reportDefaultPreset === 'thisMonth' ||
        parsed.reportDefaultPreset === 'lastMonth' ||
        parsed.reportDefaultPreset === 'last6Months' ||
        parsed.reportDefaultPreset === 'financialYear'
          ? parsed.reportDefaultPreset
          : DEFAULT_PREFS.reportDefaultPreset,
      paymentDefaultMethod:
        parsed.paymentDefaultMethod === 'cash' ||
        parsed.paymentDefaultMethod === 'upi' ||
        parsed.paymentDefaultMethod === 'card' ||
        parsed.paymentDefaultMethod === 'bank_transfer'
          ? parsed.paymentDefaultMethod
          : DEFAULT_PREFS.paymentDefaultMethod,
      estimateIncludeGSTByDefault:
        typeof parsed.estimateIncludeGSTByDefault === 'boolean'
          ? parsed.estimateIncludeGSTByDefault
          : DEFAULT_PREFS.estimateIncludeGSTByDefault,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveAppPreferences(prefs: AppPreferences): void {
  localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
}

