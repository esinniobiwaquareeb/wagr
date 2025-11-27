export interface AirtimeNetwork {
  id: 'mtn' | 'airtel' | 'glo' | 'nine_mobile';
  name: string;
  code: string;
  gradient: string;
  prefixes: string[];
  bonusTypes?: {
    code: string;
    label: string;
    description?: string;
  }[];
}

export const AIRTIME_NETWORKS: AirtimeNetwork[] = [
  {
    id: 'mtn',
    name: 'MTN',
    code: '01',
    gradient: 'from-yellow-400 to-yellow-500',
    prefixes: [
      '0803',
      '0806',
      '0703',
      '0706',
      '0810',
      '0813',
      '0814',
      '0816',
      '0903',
      '0906',
      '0913',
      '0916',
      '07025',
      '07026',
      '0704',
    ],
    bonusTypes: [
      { code: '01', label: 'Awuf 400%', description: 'MTN Awuf bonus (BonusType=01)' },
      { code: '02', label: 'Garabasa 1000%', description: 'MTN Garabasa bonus (BonusType=02)' },
    ],
  },
  {
    id: 'airtel',
    name: 'Airtel',
    code: '04',
    gradient: 'from-red-500 to-rose-500',
    prefixes: ['0802', '0808', '0708', '0812', '0701', '0902', '0907', '0901', '0912'],
  },
  {
    id: 'glo',
    name: 'Glo',
    code: '02',
    gradient: 'from-green-500 to-emerald-500',
    prefixes: ['0805', '0807', '0705', '0811', '0815', '0905'],
  },
  {
    id: 'nine_mobile',
    name: '9mobile',
    code: '03',
    gradient: 'from-emerald-600 to-teal-600',
    prefixes: ['0809', '0817', '0818', '0908', '0909'],
  },
];

export function getNetworkById(id: string): AirtimeNetwork | undefined {
  return AIRTIME_NETWORKS.find((network) => network.id === id);
}

export function getNetworkByCode(code: string): AirtimeNetwork | undefined {
  return AIRTIME_NETWORKS.find((network) => network.code === code);
}

export function normalizePhoneNumber(raw: string): string {
  if (!raw) return '';
  const digitsOnly = raw.replace(/\D/g, '');

  if (digitsOnly.length === 13 && digitsOnly.startsWith('234')) {
    return `0${digitsOnly.slice(3)}`;
  }

  if (digitsOnly.length === 10) {
    return `0${digitsOnly}`;
  }

  return digitsOnly;
}

export function isValidNigerianPhoneNumber(phoneNumber: string): boolean {
  return /^0\d{10}$/.test(phoneNumber);
}

export function detectNetworkFromPhone(phoneNumber: string): AirtimeNetwork | undefined {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (normalized.length < 4) {
    return undefined;
  }

  return AIRTIME_NETWORKS.find((network) =>
    network.prefixes.some((prefix) => normalized.startsWith(prefix)),
  );
}

