import * as React from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useAppSelector } from "@/app/hooks"
import { Link, useLocation } from "react-router-dom"

const navMain = [
  {
    title: "Account",
    url: "#",
    admin: false,
    items: [
      {
        title: "Account Settings",
        url: "/profile/settings",
      },
      {
        title: "Sessions",
        url: "/profile/sessions",
      },
      {
        title: "Bots",
        url: "/profile/bots",
      },
    ],
  },
]

export function ProfileSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  // url
  const user = useAppSelector(state => state.user)
  const location = useLocation()
  return (
    <Sidebar {...props}>
      <SidebarContent>
        {navMain.filter(
          item => item.admin === user.superUser || item.admin === false
        ).map(item => (
          <SidebarGroup key={item.title}>
            <SidebarGroupLabel>{item.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {item.items.map(item => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                      <Link to={item.url}>{item.title}</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
