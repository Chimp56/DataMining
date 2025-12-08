// Risk level constants
export const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export const RISK_COLORS = {
  [RISK_LEVELS.LOW]: '#10B981',
  [RISK_LEVELS.MEDIUM]: '#F59E0B',
  [RISK_LEVELS.HIGH]: '#EF4444',
  [RISK_LEVELS.CRITICAL]: '#DC2626',
} as const;

export const RISK_BG_COLORS = {
  [RISK_LEVELS.LOW]: 'bg-green-100 text-green-800',
  [RISK_LEVELS.MEDIUM]: 'bg-yellow-100 text-yellow-800',
  [RISK_LEVELS.HIGH]: 'bg-orange-100 text-orange-800',
  [RISK_LEVELS.CRITICAL]: 'bg-red-100 text-red-800',
} as const;

// Vessel types
export const VESSEL_TYPES = [
  'Trawler',
  'Longliner',
  'Purse Seine',
  'Gillnetter',
  'Pole & Line',
  'Dredge',
  'Other',
] as const;

// Time periods
export const TIME_PERIODS = {
  HOURS_24: '24h',
  DAYS_7: '7d',
  DAYS_30: '30d',
  DAYS_90: '90d',
  YEAR_1: '1y',
} as const;

// Search types
export const SEARCH_TYPES = {
  MMSI: 'mmsi',
  NAME: 'name',
  IMO: 'imo',
} as const;

// Prediction status
export const PREDICTION_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  FALSE_POSITIVE: 'false_positive',
} as const;

// Map constants
export const MAP_DEFAULTS = {
  CENTER: [20, 0] as [number, number],
  ZOOM: 2,
  MIN_ZOOM: 1,
  MAX_ZOOM: 18,
} as const;

// API endpoints
export const API_ENDPOINTS = {
  DASHBOARD: '/api/dashboard',
  VESSELS: '/api/vessels',
  MAP: '/api/map',
  PREDICTIONS: '/api/predictions',
  ANALYTICS: '/api/analytics',
  EXPORT: '/api/export',
} as const;

// Chart colors
export const CHART_COLORS = {
  PRIMARY: '#3B82F6',
  SUCCESS: '#10B981',
  WARNING: '#F59E0B',
  DANGER: '#EF4444',
  INFO: '#06B6D4',
  PURPLE: '#8B5CF6',
  PINK: '#EC4899',
  GRAY: '#6B7280',
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// File formats
export const EXPORT_FORMATS = {
  CSV: 'csv',
  JSON: 'json',
  XLSX: 'xlsx',
  PDF: 'pdf',
} as const;
