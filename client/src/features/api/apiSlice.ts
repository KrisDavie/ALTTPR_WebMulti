import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
import { APIKey, Event } from "@/app/types"
import { EventTypes } from "@/app/types"
import { ISession } from "@/features/dashboard/MultiworldSessions"
import { UserState } from "../user/userSlice"

const baseUrl = "/api/v1"

export const apiSlice = createApi({
  baseQuery: fetchBaseQuery({ baseUrl, credentials: "include" }),
  reducerPath: "api",
  tagTypes: ["User", "Sessions"],
  endpoints: builder => ({
    uploadMultiData: builder.mutation({
      query: ({ data, tournament, flags }) => {
        const body = new FormData()
        body.append("file", data)
        body.append("Content-Type", "multipart/form-data")
        body.append("game", 'z3')
        body.append("tournament", tournament)
        body.append("flags", JSON.stringify(flags))
        return {
          url: "/multidata",
          method: "POST",
          body: body,
        }
      },
      invalidatesTags: ["Sessions"],
    }),
    authUser: builder.query({
      query: ({ authOnly }) => {
        return {
          url: `/users/auth?auth_only=${authOnly}`,
          method: "POST",
        }
      },
      providesTags: ["User"],
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
    updateUser: builder.mutation({
      query: ({
        username,
        usernameAsPlayerName,
      }: {
        username: string 
        usernameAsPlayerName: boolean
      }) => {
        let body = {}
        if (username !== "") {
          body = {username: username}
        }
        if (usernameAsPlayerName !== undefined) {
          body = {...body, username_as_player_name: usernameAsPlayerName}
        }
        return {
          url: "/users/update",
          method: "POST",
          body: body,
        }
      },
      invalidatesTags: ["User"],
    }),
    createBot: builder.mutation<UserState, string>({
      query: botName => {
        return {
          url: "/users/bot",
          method: "POST",
          body: {
            bot_name: botName,
          },
        }
      },
      invalidatesTags: ["User"],
    }),
    createApiKey: builder.mutation<APIKey, number>({
      query: botId => {
        return {
          url: `/users/bot/${botId}/api_key`,
          method: "POST",
        }
      },
      invalidatesTags: ["User"],
    }),
    deleteBot: builder.mutation({
      query: botId => {
        return {
          url: `/users/bot/${botId}`,
          method: "DELETE",
        }
      },
      invalidatesTags: ["User"],
    }),
    revokeApiKey: builder.mutation({
      query: ({ botId, apiKeyId }: { botId: number; apiKeyId: number }) => {
        return {
          url: `/users/bot/${botId}/api_key/${apiKeyId}`,
          method: "DELETE",
        }
      },
      invalidatesTags: ["User"],
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
    getUserName: builder.query({
      query: userId => `/users/${userId}/username`,
    }),
    getAllSessions: builder.query<ISession[], number>({
      query: userId => `/users/${userId}/sessions`,
      providesTags: ["Sessions"],
      transformResponse: (response: ISession[]) => {
        return response.sort((a, b) => b.createdTimestamp - a.createdTimestamp)
      },
    }),
    getSession: builder.query<ISession, string>({
      query: sessionId => `/session/${sessionId}`,
    }),
    sendLogMessage: builder.mutation({
      query: ({ sessionId, player_id, message }) => ({
        url: `/session/${sessionId}/log`,
        method: "POST",
        body: { player_id: player_id, message: message },
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
  useSendForfeitMutation,
  useSendLogMessageMutation,
  useGetPlayersQuery,
  useGetSessionQuery,
  useGetAllSessionsQuery,
  useLazyGetPlayersQuery,
  useLazyAuthUserQuery,
  useGetUserNameQuery,
  useLazyGetUserNameQuery,
  useCreateBotMutation,
  useCreateApiKeyMutation,
  useDeleteBotMutation,
  useRevokeApiKeyMutation,
  useUpdateUserMutation,
  useLogoutUserMutation,
  useGetSessionEventsQuery,
  useSendNewItemsMutation,
} = apiSlice
