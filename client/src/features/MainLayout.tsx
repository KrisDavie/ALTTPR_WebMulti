import { ThemeProvider } from '@/components/theme-provider'
import Header from './Header'
import { Outlet } from 'react-router-dom'

function MainLayout() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <Header />
        <Outlet />
    </ThemeProvider>

  )
}

export default MainLayout