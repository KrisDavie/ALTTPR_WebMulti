import { Middleware, isAction } from "@reduxjs/toolkit"
import {
  addEvent,
  connect,
  setInitComplete,
  setPlayerInfo,
  updateMemory,
} from "./multiworldSlice"
import { sniApiSlice } from "../sni/sniApiSlice"

import type { RootState } from "@/app/store"

export const multiworldMiddleware: Middleware<{}, RootState> = api => {
  let socket: WebSocket
  return next => action => {
    if (!isAction(action)) {
      return next(action)
    }

    let originalState = api.getState()
    if (connect.match(action)) {
      if (socket) {
        return next(action)
      }
      socket = new WebSocket(
        `ws://localhost:8000/api/v1/ws/${originalState.multiworld.sessionId}`,
      )
      if (originalState.multiworld.password) {
        socket.onopen = () => {
          socket.send(originalState.multiworld.password)
        }
      }
      socket.onmessage = event => {
        let data = JSON.parse(event.data)
        let currentState = api.getState() as RootState
        if (data.type !== "new_items") {
          api.dispatch(addEvent(data))
        }

        switch (data.type) {
          case "connection_accepted":
          case "player_info_request":
            break

          case "player_join":
          case "player_leave":
            api.dispatch(addEvent(data))
            break

          case "new_items":
            data.data.forEach((item: any) => {
              api.dispatch(addEvent(item))
            })
            api.dispatch(
              // @ts-expect-error
              sniApiSlice.endpoints.sendManyItems.initiate({
                memVals: data.data.filter(
                  (item: any) =>
                    item.from_player != currentState.multiworld.player_id &&
                    item.to_player == currentState.multiworld.player_id,
                ),
              }),
            )
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
      socket.send(
        JSON.stringify({ type: "update_memory", data: action.payload }),
      )
    }

    if (setPlayerInfo.match(action)) {
      socket.send(
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
