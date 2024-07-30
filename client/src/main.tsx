import React from "react"
import { createRoot } from "react-dom/client"
import { Provider } from "react-redux"
import App from "./App"
import { store } from "./app/store"
import { createBrowserRouter, RouterProvider } from "react-router-dom"
import { loader as multiViewLoader } from "./features/multiWorld/multiView"

import "./index.css"
import MultiView from "./features/multiWorld/multiView"
import MainLayout from "./features/MainLayout"

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
        path: "/multiAdmin/:sessionId",
        element: <MultiView adminMode />,
        loader: multiViewLoader,
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
