import { create } from 'zustand'
import { addDays, startOfDay } from 'date-fns'

interface DateRangeState {
  startDate: Date
  endDate: Date
  setDateRange: (start: Date, end: Date) => void
  setStartDate: (date: Date) => void
  setEndDate: (date: Date) => void
}

export const useDateRangeStore = create<DateRangeState>((set) => ({
  startDate: startOfDay(new Date()),
  endDate: startOfDay(addDays(new Date(), 30)),
  setDateRange: (start, end) => set({ startDate: start, endDate: end }),
  setStartDate: (date) => set({ startDate: date }),
  setEndDate: (date) => set({ endDate: date }),
}))
