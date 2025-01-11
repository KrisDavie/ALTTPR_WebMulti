import { ProfileSidebar } from "@/components/profile-sidebar"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Outlet } from "react-router-dom"

export default function Dashboard() {
  return (
      <SidebarProvider>
        <ProfileSidebar />
        <SidebarInset>
          <div className="flex flex-col h-full p-4 space-y-4 justify-start items-center">
            <Outlet />
          </div>
        </SidebarInset>

      </SidebarProvider>
  )
}
