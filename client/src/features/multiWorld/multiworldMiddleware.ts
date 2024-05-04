import { Middleware, isAction } from "@reduxjs/toolkit"
import {
  addEvent,
  connect,
  reconnect,
  sendChatMessage,
  setInitComplete,
  setPlayerInfo,
  updateMemory,
} from "./multiworldSlice"
import { nanoid } from '@reduxjs/toolkit'
import { sniApiSlice } from "../sni/sniApiSlice"

import type { RootState } from "@/app/store"

const types_to_adjust = ["new_items", "init_success", "chat"]

export const multiworldMiddleware: Middleware<{}, RootState> = api => {
  let socket: WebSocket | undefined
  return next => action => {
    if (!isAction(action)) {
      return next(action)
    }

    let originalState = api.getState()

    if (reconnect.match(action)) {
      if (socket) {
        socket.close(4216, "Reconnecting")
      }
      socket = undefined
      api.dispatch(connect())
      return next(action)
    }

    if (connect.match(action)) {
      if (socket) {
        return next(action)
      }
      socket = new WebSocket(
        `ws://localhost:8000/api/v1/ws/${originalState.multiworld.sessionId}`,
      )
      if (originalState.multiworld.password) {
        socket.onopen = () => {
          socket?.send(originalState.multiworld.password)
        }
      }
      socket.onmessage = event => {
        let data = JSON.parse(event.data)
        let currentState = api.getState() as RootState
        if (!data.id) {
          data.id = nanoid()
        }
        if (!types_to_adjust.includes(data.type)) {
          api.dispatch(addEvent(data))
        }

        switch (data.type) {
          case "connection_accepted":
          case "player_info_request":
          case "player_join":
          case "player_leave":
            break

          case "init_success":
            api.dispatch(addEvent({
              event_type: "init_success",
              from_player: currentState.multiworld.player_id,
              to_player: 0,
              timestamp: Date.now(),
              event_data: {},
              id: nanoid(),
            }))
            break

          case "chat":
            api.dispatch(addEvent({
              event_type: "chat",
              from_player: data.data.from_player,
              to_player: -1,
              timestamp: Date.now(),
              event_data: { message: data.data.event_data.message },
              id: nanoid(),
            }))
            break

          case "new_items":
            const sorted_data = data.data.sort((a: any, b: any) => a.id - b.id)
            sorted_data.forEach((item: any) => {
              item.timestamp = item.timestamp * 1000 // Convert to milliseconds
              api.dispatch(addEvent(item))
            })
            api.dispatch(
              // @ts-expect-error
              sniApiSlice.endpoints.sendManyItems.initiate({
                memVals: sorted_data.filter(
                  (item: any) =>
                    item.from_player != currentState.multiworld.player_id &&
                    item.to_player == currentState.multiworld.player_id,
                ),
              }),
            )
            break
          default:
            console.log("Unknown event type: " + data.type)
            break
        }
      }
      // Try to reconnect if the connection is closed
      socket.onclose = event => {
        if (event.reason !== "") {
          alert("Connection closed: " + event.reason)
          return
        } else {
          setTimeout(() => {
            api.dispatch(connect())
          }, 1000)
        }
      }
    }
    if (updateMemory.match(action)) {
      socket?.send(
        JSON.stringify({ type: "update_memory", data: action.payload }),
      )
    }

    if (sendChatMessage.match(action)) {
      socket?.send(
        JSON.stringify({
          type: "chat",
          data: action.payload.message,
        }),
      )
    }
      

    if (setPlayerInfo.match(action)) {
      socket?.send(
        JSON.stringify({
          type: "player_info",
          player_id: action.payload.player_id,
          player_name: `Player ${action.payload}`,
          rom_name: action.payload.rom_name,
        }),
      )
      api.dispatch(setInitComplete(true))
    }

    return next(action)
  }
}
