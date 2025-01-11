import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
import { Event } from "@/app/types"
import { EventTypes } from "@/app/types"
import { ISession } from "@/components/dashboard/MultiworldSessions"

const baseUrl = "/api/v1"

export const apiSlice = createApi({
  baseQuery: fetchBaseQuery({ baseUrl, credentials: "include" }),
  reducerPath: "api",
  tagTypes: ["User", "Sessions"],
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
      invalidatesTags: ["Sessions"],
    }),
    authUser: builder.mutation({
      query: ({ authOnly }) => {
        return {
          url: `/users/auth?auth_only=${authOnly}`,
          method: "POST",
        }
      },
    }),
    logoutUser: builder.mutation({
      query: () => {
        return {
          url: "/users/logout",
          method: "POST",
        }
      },
      invalidatesTags: ["User", "Sessions"],
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
    getAllSessions: builder.query<ISession[], number>({
      query: userId => `/users/${userId}/sessions`,
      providesTags: ["Sessions"],
      transformResponse: (response: ISession[]) => {
        return response.sort((a, b) => b.createdTimestamp - a.createdTimestamp)
      }
    }),
    getSession: builder.query<ISession, string>({
      query: sessionId => `/session/${sessionId}`,
    }),
    sendLogMessage: builder.mutation({
      query: ({ sessionId, player_id, message }) => ({
        url: `/session/${sessionId}/log`,
        method: "POST",
        body: { player_id: player_id,
                message: message },
      }),
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
    startDebug: builder.mutation({
      query: ({ sessionId, numItems }) => ({
        url: `/session/${sessionId}/debug/${numItems}`,
        method: "POST",
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
        url: `/session/${sessionId}/adminSend`,
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
  useStartDebugMutation,
  useSendForfeitMutation,
  useSendLogMessageMutation,
  useGetPlayersQuery,
  useGetSessionQuery,
  useGetAllSessionsQuery,
  useLazyGetPlayersQuery,
  useAuthUserMutation,
  useLogoutUserMutation,
  useGetSessionEventsQuery,
  useSendNewItemsMutation,
} = apiSlice
