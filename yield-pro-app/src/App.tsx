import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './components/auth/AuthProvider'
import { useAuthStore } from './store/useAuthStore'
import { LoginForm } from './components/auth/LoginForm'
import { RegisterForm } from './components/auth/RegisterForm'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { DashboardContent } from './components/dashboard/DashboardContent'
import { AdminPanel } from './components/admin/AdminPanel'
import { PricingGrid } from './components/grid/PricingGrid'
import { RMSSettingsPage } from './components/settings/RMSSettingsPage'
import { CalendarInsightsPage } from './components/pages/CalendarInsightsPage'
import { ReservationSimulatorPage } from './components/pages/ReservationSimulatorPage'
import { HelpCalibrationPage } from './components/pages/HelpCalibrationPage'
import { HelpGeneralPage } from './components/pages/HelpGeneralPage'
import { YieldAnalysisPage } from './components/pages/YieldAnalysisPage'
import { MyUnavailabilityPage } from './components/pages/MyUnavailabilityPage'
import {
  CompetitorsPage,
  HistoryPage
} from './components/pages/PlaceholderPages'
import { Loader2 } from 'lucide-react'

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean }> = ({
  children,
  adminOnly = false
}) => {
  const { user, profile, loading, initialized } = useAuthStore()

  if (!initialized || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" />
  }

  if (adminOnly && profile?.role !== 'admin') {
    return <Navigate to="/dashboard" />
  }

  return <>{children}</>
}

function App() {
  const { user } = useAuthStore()

  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={
            user ? <Navigate to="/dashboard" /> : (
              <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <LoginForm />
              </div>
            )
          } />
          <Route path="/register" element={
            user ? <Navigate to="/dashboard" /> : (
              <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <RegisterForm />
              </div>
            )
          } />

          {/* Protected Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardLayout>
                <DashboardContent />
              </DashboardLayout>
            </ProtectedRoute>
          } />

          <Route path="/grid" element={
            <ProtectedRoute>
              <DashboardLayout>
                <PricingGrid />
              </DashboardLayout>
            </ProtectedRoute>
          } />

          <Route path="/competitors" element={
            <ProtectedRoute>
              <DashboardLayout>
                <CompetitorsPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />

          <Route path="/yield" element={
            <ProtectedRoute>
              <DashboardLayout>
                <YieldAnalysisPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />

          <Route path="/history" element={
            <ProtectedRoute>
              <DashboardLayout>
                <HistoryPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />

          <Route path="/calendar-arrivals" element={
            <ProtectedRoute>
              <DashboardLayout>
                <CalendarInsightsPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />

          <Route path="/mes-indisponibilites" element={
            <ProtectedRoute>
              <DashboardLayout>
                <MyUnavailabilityPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />

          <Route path="/reservation-simulator" element={
            <ProtectedRoute>
              <DashboardLayout>
                <ReservationSimulatorPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />

          <Route path="/help-calibrage" element={
            <ProtectedRoute>
              <DashboardLayout>
                <HelpCalibrationPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />

          <Route path="/help-general" element={
            <ProtectedRoute>
              <DashboardLayout>
                <HelpGeneralPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />

          <Route path="/settings" element={
            <ProtectedRoute>
              <DashboardLayout>
                <RMSSettingsPage />
              </DashboardLayout>
            </ProtectedRoute>
          } />

          <Route path="/admin" element={
            <ProtectedRoute adminOnly>
              <DashboardLayout>
                <AdminPanel />
              </DashboardLayout>
            </ProtectedRoute>
          } />

          {/* Default Redirect */}
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App
