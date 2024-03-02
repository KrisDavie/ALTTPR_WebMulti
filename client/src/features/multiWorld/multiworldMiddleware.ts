import { Middleware, isAction } from "@reduxjs/toolkit"
import {
  addEvent,
  connect,
  setInitComplete,
  setPlayerId,
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
        console.log(data)
        if (data.type !== "new_items") {
          api.dispatch(addEvent(data))
        }

        switch (data.type) {
          case "connection_accepted":
            break

          case "player_info_request":

          case "new_items":
            data.data.forEach((item: any) => {
              console.log(item)
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
      socket.onclose = () => {
        setTimeout(() => {
          api.dispatch(connect())
        }, 1000)
      }
    }
    if (updateMemory.match(action)) {
      socket.send(
        JSON.stringify({ type: "update_memory", data: action.payload }),
      )
    }

    if (setPlayerId.match(action)) {
      socket.send(
        JSON.stringify({
          type: "player_info",
          player_id: action.payload,
          player_name: `Player ${action.payload}`,
        }),
      )
      api.dispatch(setInitComplete(true))
    }

    return next(action)
  }
}
