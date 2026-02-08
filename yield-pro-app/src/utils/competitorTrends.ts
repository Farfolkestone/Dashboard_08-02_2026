export type GenericTarifRow = Record<string, unknown>

export interface TariffSnapshot {
  date: string
  demand: number
  ownPrice: number
  compsetMedian: number
}

export interface TrendSeriesRow {
  date: string
  ownPrice: number
  compsetMedian: number
  demand: number
  ownVs3j: number | null
  ownVs7j: number | null
  compsetVs3j: number | null
  compsetVs7j: number | null
  demandVs3j: number | null
  demandVs7j: number | null
}

export interface TrendSummary {
  avgOwnVs3j: number
  avgOwnVs7j: number
  avgCompsetVs3j: number
  avgCompsetVs7j: number
  avgDemandVs3j: number
  avgDemandVs7j: number
  comparedDays3j: number
  comparedDays7j: number
}

const parseNumberLike = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return 0

  const cleaned = value
    .trim()
    .replace(/\u00A0/g, '')
    .replace(/\s+/g, '')
    .replace(/[€$£%]/g, '')
    .replace(/[^\d,.-]/g, '')

  if (!cleaned) return 0
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      const parsed = Number(cleaned.replace(/\./g, '').replace(',', '.'))
      return Number.isFinite(parsed) ? parsed : 0
    }
    const parsed = Number(cleaned.replace(/,/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (cleaned.includes(',')) {
    const parsed = Number(cleaned.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : 0
  }

  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()

const isMetaColumn = (column: string) => {
  const n = normalize(column)
  return (
    n === 'id' ||
    n === 'hotelid' ||
    n.includes('date') ||
    n === 'jour' ||
    n.includes('miseajour')
  )
}

const toDateKey = (value: string): string => {
  if (!value) return ''
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/')
    return `${y}-${m}-${d}`
  }
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return ''
  const yyyy = parsed.getFullYear()
  const mm = `${parsed.getMonth() + 1}`.padStart(2, '0')
  const dd = `${parsed.getDate()}`.padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const median = (values: number[]) => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2
  return sorted[mid]
}

export const extractTariffSnapshot = (row: GenericTarifRow): TariffSnapshot | null => {
  const dateRaw = typeof row.Date === 'string' ? row.Date : (typeof row.date === 'string' ? row.date : '')
  const date = toDateKey(dateRaw)
  if (!date) return null

  let demand = 0
  let ownPrice = 0
  const competitorPrices: number[] = []

  Object.entries(row).forEach(([key, value]) => {
    if (isMetaColumn(key)) return
    const nKey = normalize(key)
    const numeric = parseNumberLike(value)
    if (numeric <= 0) return

    if (nKey.includes('demandedumarche') || (nKey.includes('demande') && nKey.includes('marche'))) {
      demand = numeric <= 1 ? numeric * 100 : numeric
      return
    }
    if (nKey.includes('folkestone')) {
      ownPrice = numeric
      return
    }
    competitorPrices.push(numeric)
  })

  return {
    date,
    demand,
    ownPrice,
    compsetMedian: median(competitorPrices),
  }
}

const avg = (values: Array<number | null>) => {
  const valid = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (valid.length === 0) return 0
  return valid.reduce((sum, v) => sum + v, 0) / valid.length
}

export const buildTrendSeries = (
  currentRows: GenericTarifRow[],
  vs3Rows: GenericTarifRow[],
  vs7Rows: GenericTarifRow[]
) => {
  const current = currentRows.map(extractTariffSnapshot).filter((r): r is TariffSnapshot => Boolean(r))
  const vs3Map = new Map(
    vs3Rows
      .map(extractTariffSnapshot)
      .filter((r): r is TariffSnapshot => Boolean(r))
      .map((r) => [r.date, r] as const)
  )
  const vs7Map = new Map(
    vs7Rows
      .map(extractTariffSnapshot)
      .filter((r): r is TariffSnapshot => Boolean(r))
      .map((r) => [r.date, r] as const)
  )

  const series: TrendSeriesRow[] = current
    .map((row) => {
      const d3 = vs3Map.get(row.date)
      const d7 = vs7Map.get(row.date)
      return {
        date: row.date,
        ownPrice: row.ownPrice,
        compsetMedian: row.compsetMedian,
        demand: row.demand,
        ownVs3j: d3 && d3.ownPrice > 0 ? row.ownPrice - d3.ownPrice : null,
        ownVs7j: d7 && d7.ownPrice > 0 ? row.ownPrice - d7.ownPrice : null,
        compsetVs3j: d3 && d3.compsetMedian > 0 ? row.compsetMedian - d3.compsetMedian : null,
        compsetVs7j: d7 && d7.compsetMedian > 0 ? row.compsetMedian - d7.compsetMedian : null,
        demandVs3j: d3 ? row.demand - d3.demand : null,
        demandVs7j: d7 ? row.demand - d7.demand : null,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  const summary: TrendSummary = {
    avgOwnVs3j: avg(series.map((r) => r.ownVs3j)),
    avgOwnVs7j: avg(series.map((r) => r.ownVs7j)),
    avgCompsetVs3j: avg(series.map((r) => r.compsetVs3j)),
    avgCompsetVs7j: avg(series.map((r) => r.compsetVs7j)),
    avgDemandVs3j: avg(series.map((r) => r.demandVs3j)),
    avgDemandVs7j: avg(series.map((r) => r.demandVs7j)),
    comparedDays3j: series.filter((r) => r.ownVs3j !== null || r.compsetVs3j !== null || r.demandVs3j !== null).length,
    comparedDays7j: series.filter((r) => r.ownVs7j !== null || r.compsetVs7j !== null || r.demandVs7j !== null).length,
  }

  return { series, summary }
}
