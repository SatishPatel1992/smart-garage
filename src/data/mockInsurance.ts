export interface InsuranceCompany {
  id: string;
  name: string;
}

export const MOCK_INSURANCE_COMPANIES: InsuranceCompany[] = [
  { id: 'ins0', name: 'No insurance' },
  { id: 'ins1', name: 'Future Generali India Insurance' },
  { id: 'ins2', name: 'ICICI Lombard' },
  { id: 'ins3', name: 'HDFC Ergo' },
  { id: 'ins4', name: 'Bajaj Allianz' },
  { id: 'ins5', name: 'Tata AIG' },
];

export function getInsuranceById(id: string): InsuranceCompany | undefined {
  return MOCK_INSURANCE_COMPANIES.find((c) => c.id === id);
}
