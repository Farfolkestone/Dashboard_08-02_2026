import React from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useDateRangeStore } from '../../store/useDateRangeStore'

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
                    onDateChange={(dates: [Date | null, Date | null]) => {
                        if (dates[0] && dates[1]) {
                            setDateRange(dates[0], dates[1])
                        }
                    }}
                />
                <main className="flex-grow overflow-y-auto p-8">
                    {children}
                </main>
            </div>
        </div>
    )
}
