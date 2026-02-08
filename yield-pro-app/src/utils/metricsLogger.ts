export type MetricPayload = Record<string, unknown>

const STORAGE_KEY = 'yield_rms_metrics_log'
const MAX_ITEMS = 400

type MetricEntry = {
  ts: string
  scope: string
  payload: MetricPayload
}

const readMetrics = (): MetricEntry[] => {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as MetricEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeMetrics = (entries: MetricEntry[]) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ITEMS)))
  } catch {
    // ignore quota errors
  }
}

export const pushMetric = (scope: string, payload: MetricPayload) => {
  const entry: MetricEntry = {
    ts: new Date().toISOString(),
    scope,
    payload,
  }

  const next = [...readMetrics(), entry]
  writeMetrics(next)

  if (typeof console !== 'undefined') {
    console.info('[RMS_METRIC]', scope, payload)
  }
}

export const getMetrics = (scope?: string, limit = 30): MetricEntry[] => {
  const rows = readMetrics()
  const filtered = scope ? rows.filter((row) => row.scope === scope) : rows
  return filtered.slice(-limit)
}

export const clearMetrics = () => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}
