import { format } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'
import { pushMetric } from '../utils/metricsLogger'

type PlanningTarifRow = Database['public']['Tables']['planning_tarifs']['Row']

type PlanningTarifLike = PlanningTarifRow & {
  date: string
}

const PAGE_SIZE = 1000
const MAX_SCAN_ROWS = 200000

const parseLocalDate = (value: string | null | undefined): Date | null => {
  if (!value) return null
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    const localIso = new Date(Number(year), Number(month) - 1, Number(day))
    if (!Number.isNaN(localIso.getTime())) return localIso
  }

  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) return parsed
  return null
}

const inRange = (value: string | null | undefined, startDate: Date, endDate: Date) => {
  const parsed = parseLocalDate(value)
  if (!parsed) return false

  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)

  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)

  return parsed >= start && parsed <= end
}

const fetchPlanningPaged = async (queryBuilder: (from: number, to: number) => ReturnType<typeof supabase.from>) => {
  const rows: PlanningTarifLike[] = []
  let offset = 0
  let pages = 0

  while (offset < MAX_SCAN_ROWS) {
    const from = offset
    const to = offset + PAGE_SIZE - 1
    // We must rebuild query every page to avoid mutating a consumed builder.
    const query = queryBuilder(from, to)
    const { data, error } = await query
    if (error) throw error

    const page = (data || []) as PlanningTarifLike[]
    rows.push(...page)
    pages += 1

    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return {
    rows,
    pages,
    scanned: rows.length,
  }
}

const queryPlanningByHotel = async (hotelId: string, startIso: string, endIso: string) => {
  return fetchPlanningPaged((from, to) =>
    supabase
      .from('planning_tarifs')
      .select('*')
      .eq('hotel_id', hotelId)
      .gte('date', startIso)
      .lte('date', endIso)
      .order('date', { ascending: true })
      .range(from, to)
  )
}

const queryPlanningGlobal = async (startIso: string, endIso: string) => {
  return fetchPlanningPaged((from, to) =>
    supabase
      .from('planning_tarifs')
      .select('*')
      .gte('date', startIso)
      .lte('date', endIso)
      .order('date', { ascending: true })
      .range(from, to)
  )
}

const fetchPlanningTarifs = async (hotelId: string, startDate: Date, endDate: Date): Promise<PlanningTarifRow[]> => {
  const startIso = format(startDate, 'yyyy-MM-dd')
  const endIso = format(endDate, 'yyyy-MM-dd')
  const t0 = performance.now()

  let result = await queryPlanningByHotel(hotelId, startIso, endIso)
  let strategy = 'hotel-filter'

  if (result.rows.length === 0) {
    result = await queryPlanningGlobal(startIso, endIso)
    strategy = 'global-fallback'
  }

  const filtered = result.rows
    .filter((row) => inRange(row.date, startDate, endDate))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))

  pushMetric('planning_tarifs_fetch', {
    hotelId,
    strategy,
    startIso,
    endIso,
    pages: result.pages,
    scanned: result.scanned,
    rowsFetched: result.rows.length,
    rowsReturned: filtered.length,
    ms: Math.round(performance.now() - t0),
  })

  return filtered
}

export const usePlanningTarifs = (hotelId: string, startDate: Date, endDate: Date) => {
  const startIso = format(startDate, 'yyyy-MM-dd')
  const endIso = format(endDate, 'yyyy-MM-dd')

  return useQuery({
    queryKey: ['planning-tarifs', hotelId, startIso, endIso],
    queryFn: () => fetchPlanningTarifs(hotelId, startDate, endDate),
    enabled: !!hotelId,
  })
}
