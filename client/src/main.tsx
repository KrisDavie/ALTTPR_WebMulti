import React from "react"
import { createRoot } from "react-dom/client"
import { Provider } from "react-redux"
import App from "./App"
import { store } from "./app/store"
import { createBrowserRouter, RouterProvider } from "react-router-dom"
import MultiView, { loader as multiViewLoader } from "./features/multiWorld/MultiView"

import "./index.css"
import MainLayout from "./features/MainLayout"
import Dashboard from "./components/dashboard/Dashboard"
import { loader as dashboardLoader } from "./components/dashboard/dashboardLoader"
import { MultiworldSessions } from "./components/dashboard/MultiworldSessions"

const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      {
        path: "/",
        element: <App />,
      },
      {
        path: "/multi/:sessionId",
        element: <MultiView />,
        loader: multiViewLoader,
      },
      {
        path: "/profile/",
        element: <Dashboard />,
        loader: dashboardLoader,
        children: [
          {
            path: "/profile/sessions",
            element: <MultiworldSessions />,
          },
        ]
      },
    ],
  },
])

const container = document.getElementById("root")

if (container) {
  const root = createRoot(container)

  root.render(
    <React.StrictMode>
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    </React.StrictMode>,
  )
} else {
  throw new Error(
    "Root element with ID 'root' was not found in the document. Ensure there is a corresponding HTML element with the ID 'root' in your HTML file.",
  )
}
