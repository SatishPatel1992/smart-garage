import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { me as meApi, organizations as orgsApi } from '../api/client';
import type { OrgSettings } from '../api/client';

const DEFAULT_TAX_RATES = [0, 5, 12, 18, 28];
const DEFAULT_ESTIMATE_VALIDITY_DAYS = 14;
const DEFAULT_LOW_STOCK_THRESHOLD = 5;
const DEFAULT_GST_RATE = 18;

type Organization = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  gstin: string | null;
  settings: OrgSettings | null;
};

type SettingsState = {
  organization: Organization | null;
  loading: boolean;
  error: string | null;
};

type SettingsContextValue = SettingsState & {
  refresh: () => Promise<void>;
  updateSettings: (body: { name?: string; address?: string | null; phone?: string | null; gstin?: string | null; settings?: Partial<OrgSettings> }) => Promise<void>;
  getTaxRates: () => number[];
  getDefaultGstRatePercent: () => number;
  getEstimateValidityDays: () => number;
  getLowStockThreshold: () => number;
  getInvoiceDefaultFormat: () => 'proforma' | 'tax';
  getCurrency: () => string;
  /** When true, tax is shown in estimates/invoices and GSTIN is required */
  isGstEnabled: () => boolean;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<SettingsState>({
    organization: null,
    loading: false,
    error: null,
  });

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await meApi.get();
      setState({
        organization: res.organization
          ? {
              id: res.organization.id,
              name: res.organization.name,
              address: res.organization.address,
              phone: res.organization.phone,
              gstin: res.organization.gstin,
              settings: res.organization.settings ?? null,
            }
          : null,
        loading: false,
        error: null,
      });
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load settings',
      }));
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateSettings = useCallback(
    async (body: Parameters<SettingsContextValue['updateSettings']>[0]) => {
      await orgsApi.updateSettings(body);
      await refresh();
    },
    [refresh]
  );

  const getTaxRates = useCallback((): number[] => {
    const rates = state.organization?.settings?.defaultTaxRates;
    return rates && rates.length > 0 ? rates : DEFAULT_TAX_RATES;
  }, [state.organization?.settings?.defaultTaxRates]);

  const getDefaultGstRatePercent = useCallback((): number => {
    return state.organization?.settings?.defaultGstRatePercent ?? DEFAULT_GST_RATE;
  }, [state.organization?.settings?.defaultGstRatePercent]);

  const getEstimateValidityDays = useCallback((): number => {
    return state.organization?.settings?.estimateValidityDays ?? DEFAULT_ESTIMATE_VALIDITY_DAYS;
  }, [state.organization?.settings?.estimateValidityDays]);

  const getLowStockThreshold = useCallback((): number => {
    return state.organization?.settings?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
  }, [state.organization?.settings?.lowStockThreshold]);

  const getInvoiceDefaultFormat = useCallback((): 'proforma' | 'tax' => {
    return state.organization?.settings?.invoiceDefaultFormat ?? 'tax';
  }, [state.organization?.settings?.invoiceDefaultFormat]);

  const getCurrency = useCallback((): string => {
    return state.organization?.settings?.currency ?? 'INR';
  }, [state.organization?.settings?.currency]);

  const isGstEnabled = useCallback((): boolean => {
    return state.organization?.settings?.gstEnabled === true;
  }, [state.organization?.settings?.gstEnabled]);

  const value: SettingsContextValue = {
    ...state,
    refresh,
    updateSettings,
    getTaxRates,
    getDefaultGstRatePercent,
    getEstimateValidityDays,
    getLowStockThreshold,
    getInvoiceDefaultFormat,
    getCurrency,
    isGstEnabled,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

export { DEFAULT_TAX_RATES, DEFAULT_ESTIMATE_VALIDITY_DAYS, DEFAULT_LOW_STOCK_THRESHOLD, DEFAULT_GST_RATE };
