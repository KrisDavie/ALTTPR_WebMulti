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
    getPlayers: builder.query({
      query: sessionId => `/session/${sessionId}/players`,
    }),
    sendForfeit: builder.mutation({
      query: ({ sessionId, playerId }) => ({
        url: `/session/${sessionId}/player_forfeit`,
        method: "POST",
        body: {
          player_id: playerId,
        },
      }),
    }),
    sendNewItems: builder.mutation({
      query: ({
        sessionId,
        itemId,
        players,
        password,
      }: {
        sessionId: string
        itemId: number
        players: number[]
        password: string | undefined
      }) => ({
        url: `/admin/${sessionId}/send`,
        method: "POST",
        body: {
          event_type: players.length > 1 ? "send_multi" : "send_single",
          to_players: players.length > 1 ? players : players[0],
          item_id: itemId,
          password: password,
        },
      }),
    }),
  }),
})

export const {
  useUploadMultiDataMutation,
  useSendForfeitMutation,
  useGetPlayersQuery,
  useGetSessionEventsQuery,
  useSendNewItemsMutation,
} = apiSlice
