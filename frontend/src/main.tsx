import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'
import './portal.css'
import './management.css'
import './search.css'
import { ConfigProvider } from 'antd'
import viVN from 'antd/locale/vi_VN'
import { AuthProvider } from './auth/AuthContext'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={viVN} theme={{ token: { colorPrimary: '#176b45', colorInfo: '#257fa4', colorSuccess: '#176b45', colorWarning: '#d99020', colorError: '#d14343', colorBgLayout: '#f6f8f5', colorText: '#173128', colorBorder: '#e3e8e2', borderRadius: 10, fontFamily: '"Be Vietnam Pro", Inter, system-ui, sans-serif' }, components: { Button: { controlHeight: 40 }, Input: { controlHeight: 40 }, Select: { controlHeight: 40 }, Table: { headerBg: '#f3f7f3' } } }}>
        <AuthProvider><BrowserRouter><App /></BrowserRouter></AuthProvider>
      </ConfigProvider>
    </QueryClientProvider>
  </StrictMode>,
)
