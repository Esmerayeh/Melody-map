import React, { Suspense } from 'react'
import { BrowserRouter as Router } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import PageLoader from './components/PageLoader'
import AnimatedRoutes from './app/AnimatedRoutes'
import VibeBridge from './app/VibeBridge'
import { useAuthBootstrap } from './app/AuthBootstrap'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
})

export default function App() {
  useAuthBootstrap()

  return (
    <QueryClientProvider client={queryClient}>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Suspense fallback={<PageLoader />}>
          <AnimatedRoutes />
        </Suspense>
        <VibeBridge />

        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'linear-gradient(180deg, rgba(23,20,43,0.92), rgba(12,11,24,0.96))',
              color: '#f3efff',
              border: '1px solid rgba(143,117,255,0.28)',
              backdropFilter: 'blur(24px)',
              boxShadow: '0 16px 38px rgba(0,0,0,0.4)',
            },
            success: { iconTheme: { primary: '#8f75ff', secondary: '#fff' } },
          }}
        />
      </Router>
    </QueryClientProvider>
  )
}
