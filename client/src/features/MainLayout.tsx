import { ThemeProvider } from '@/components/theme-provider'
import Header from './Header'
import { Outlet } from 'react-router-dom'

function MainLayout() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="flex flex-col h-screen">
        <Header />
        <Outlet />
      </div>
    </ThemeProvider>

  )
}

export default MainLayout