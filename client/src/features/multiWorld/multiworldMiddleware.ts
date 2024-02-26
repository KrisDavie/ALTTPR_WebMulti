import { Middleware, UnknownAction, isAction } from "@reduxjs/toolkit"
import { connect, setPlayerId, updateMemory } from "./multiworldSlice"
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
        switch (data.type) {
          case "connection_accepted":
            break
          case "new_item":
            const currentState = api.getState() as RootState
            if ((data.data.from_player != currentState.multiworld.player_id) && (data.data.to_player == currentState.multiworld.player_id)) {
              api.dispatch(
                // @ts-expect-error
                sniApiSlice.endpoints.sendMemory.initiate({
                  memLoc: "0x7e0000",
                  memVal: {"item_id": data.data.item_id, "from_player": data.data.from_player},
                }),
              )
            }
            break
        }
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
    }

    return next(action)
  }
}
