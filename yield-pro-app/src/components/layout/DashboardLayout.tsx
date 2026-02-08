import React from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useDateRangeStore } from '../../store/useDateRangeStore'
import { addDays } from 'date-fns'

interface DashboardLayoutProps {
    children: React.ReactNode
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
    const { startDate, endDate, setDateRange } = useDateRangeStore()

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden">
            <Sidebar />
            <div className="flex-grow flex flex-col min-w-0">
                <Header
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={(nextStart: Date) => {
                        const safeEnd = endDate && endDate >= nextStart ? endDate : addDays(nextStart, 1)
                        setDateRange(nextStart, safeEnd)
                    }}
                    onEndDateChange={(nextEnd: Date) => {
                        const safeStart = startDate && startDate <= nextEnd ? startDate : nextEnd
                        setDateRange(safeStart, nextEnd)
                    }}
                />
                <main className="flex-grow overflow-y-auto p-8">
                    {children}
                </main>
            </div>
        </div>
    )
}
