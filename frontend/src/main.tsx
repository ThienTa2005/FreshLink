import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'
import './portal.css'
import { ConfigProvider } from 'antd'
import viVN from 'antd/locale/vi_VN'
import { AuthProvider } from './auth/AuthContext'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={viVN} theme={{ token: { colorPrimary: '#176b3a', borderRadius: 10, fontFamily: 'Inter, system-ui, sans-serif' } }}>
        <AuthProvider><BrowserRouter><App /></BrowserRouter></AuthProvider>
      </ConfigProvider>
    </QueryClientProvider>
  </StrictMode>,
)
