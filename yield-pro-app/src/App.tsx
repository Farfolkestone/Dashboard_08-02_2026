import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './components/auth/AuthProvider'
import { useAuthStore } from './store/useAuthStore'
import { LoginForm } from './components/auth/LoginForm'
import { RegisterForm } from './components/auth/RegisterForm'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { DashboardContent } from './components/dashboard/DashboardContent'
import { AdminPanel } from './components/admin/AdminPanel'
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
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
              <LoginForm />
            </div>
          } />
          <Route path="/register" element={
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
              <RegisterForm />
            </div>
          } />

          {/* Protected Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardLayout>
                <DashboardContent />
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
