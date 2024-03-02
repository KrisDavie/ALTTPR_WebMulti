import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
import { Event } from "@/app/types"
import { EventTypes } from "@/app/types"

const baseUrl = "/api/v1"

export const apiSlice = createApi({
  baseQuery: fetchBaseQuery({ baseUrl }),
  reducerPath: "api",
  endpoints: builder => ({
    uploadMultiData: builder.mutation({
      query: ({ data, game }) => {
        const body = new FormData()
        body.append("file", data)
        body.append("Content-Type", "multipart/form-data")
        body.append("game", game)
        return {
          url: "/multidata",
          method: "POST",
          body: body,
        }
      },
    }),
    getSessionEvents: builder.query({
      query: sessionId => `/session/${sessionId}/events`,
      transformResponse: (response: Event[]) => {
        const transformedResponse = response.map(event => ({
          ...event,
          event_type: EventTypes[event.event_type as number],
        }))
        return transformedResponse
      },
    }),
  }),
})

export const { useUploadMultiDataMutation, useGetSessionEventsQuery } = apiSlice
