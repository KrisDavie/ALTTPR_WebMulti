import { Middleware, isAction } from "@reduxjs/toolkit"
import {
  addEvent,
  connect,
  reconnect,
  sendChatMessage,
  setInitComplete,
  setPlayerInfo,
  pauseReceiving,
  resumeReceiving,
  setSramUpdatingOnServer,
  updateMemory,
  setConnectionState,
} from "./multiworldSlice"
import { nanoid } from "@reduxjs/toolkit"
import { log } from "../loggerSlice"

import type { RootState } from "@/app/store"
import { addItemsToQueue } from "../sni/sniSlice"
import { Event, ItemEvent } from "@/app/types"

const types_to_adjust = [
  "new_items",
  "init_success",
  "chat",
  "player_join",
  "player_leave",
]

export const multiworldMiddleware: Middleware<object, RootState> = api => {
  let socket: WebSocket | undefined
  return next => action => {
    if (!isAction(action)) {
      return next(action)
    }

    const originalState = api.getState()

    if (reconnect.match(action)) {
      if (socket) {
        socket.close(4216, action.payload.reason)
      }
      socket = undefined
      api.dispatch(connect())
      return next(action)
    }

    if (connect.match(action)) {
      if (socket) {
        return next(action)
      }
      api.dispatch(
        log(
          `Connecting to multiworld session websocket ${originalState.multiworld.sessionId}`,
        ),
      )
      socket = new WebSocket(
        `${import.meta.env.VITE_BACKEND_WS_URL}/api/v1/ws/${originalState.multiworld.sessionId}`,
      )
      if (originalState.multiworld.password) {
        socket.onopen = () => {
          socket?.send(originalState.multiworld.password)
        }
      }
      socket.onmessage = event => {
        const data = JSON.parse(event.data)
        const currentState = api.getState() as RootState
        if (!data.id) {
          data.id = nanoid()
        }
        if (!types_to_adjust.includes(data.type)) {
          api.dispatch(addEvent(data))
        }

        switch (data.type) {
          case "connection_accepted":
            break;

          case "player_info_request":
            api.dispatch(setConnectionState("player_info"))
            break

          case "sram_updated":
            api.dispatch(setSramUpdatingOnServer(false))
            break

          case "player_join":
            api.dispatch(log(`Player ${data.data.from_player} joined`))
            api.dispatch(
              addEvent({
                event_type: "player_join",
                from_player: data.data.from_player,
                to_player: -1,
                timestamp: data.data.timestamp * 1000,
                event_data: {},
                id: nanoid(),
              }),
            )
            break

          case "player_leave":
            api.dispatch(log(`Player ${data.data.from_player} left`))
            api.dispatch(
              addEvent({
                event_type: "player_leave",
                from_player: data.data.from_player,
                to_player: -1,
                timestamp: data.data.timestamp * 1000,
                event_data: {},
                id: nanoid(),
              }),
            )
            break

          case "init_success":
            api.dispatch(log(`Multiworld init success`))
            api.dispatch(
              addEvent({
                event_type: "init_success",
                from_player: currentState.multiworld.player_id,
                to_player: 0,
                timestamp: Date.now(),
                event_data: {},
                id: nanoid(),
              }),
            )
            break

          case "chat":
            api.dispatch(
              log(
                `Chat message (${data.data.from_player}}) : ${data.data.event_data.message}`,
              ),
            )
            api.dispatch(
              addEvent({
                event_type: "chat",
                from_player: data.data.from_player,
                to_player: -1,
                timestamp: data.data.timestamp * 1000,
                event_data: { message: data.data.event_data.message, user_id: data.data.event_data.user_id },
                id: nanoid(),
              }),
            )
            break

          case "new_items": {
            const sorted_data = data.data
              .filter(
                (item: ItemEvent) => item.event_idx && item.event_idx.length == 2,
              )
              .sort(
                (a: ItemEvent, b: ItemEvent) =>
                  a.event_idx[0] * 256 +
                  a.event_idx[1] -
                  (b.event_idx[0] * 256 + b.event_idx[1]),
              )

            sorted_data.forEach((item: ItemEvent) => {
              item.timestamp = item.timestamp * 1000 // Convert to milliseconds
              api.dispatch(addEvent(item))
            })

            const self_data = sorted_data.filter(
              (item: Event) =>
                item.from_player != currentState.multiworld.player_id &&
                item.to_player == currentState.multiworld.player_id,
            )
            // api.dispatch(log(`Items:`))
            // self_data.map((item: any) =>
            //   api.dispatch(
            //     log(
            //       `IX: ${item.event_idx[0] * 256 + item.event_idx[1]}: ${item.event_data.item_name} (${item.event_data.location_name}) ${item.from_player} -> ${item.to_player}`,
            //     ),
            //   ),
            // )
            if (self_data.length > 0) {
              api.dispatch(
                addItemsToQueue(
                  self_data.filter(
                    (item: Event) =>
                      item.from_player != currentState.multiworld.player_id &&
                      item.to_player == currentState.multiworld.player_id,
                  ),
                ),
              )
            }

            break
          }
          case "player_pause_receive":
            api.dispatch(
              addEvent({
                event_type: "player_pause_receive",
                from_player: data.data.from_player,
                to_player: -1,
                timestamp: data.data.timestamp * 1000,
                event_data: {},
                id: nanoid(),
              }),
            )
            break
          case "player_resume_receive":
            api.dispatch(
              addEvent({
                event_type: "player_resume_receive",
                from_player: data.data.from_player,
                to_player: -1,
                timestamp: data.data.timestamp * 1000,
                event_data: {},
                id: nanoid(),
              }),
            )
            break
          case "non_player_detected":
            api.dispatch(
              addEvent({
                event_type: "chat",
                from_player:-1,
                to_player: -1,
                timestamp: Date.now(),
                event_data: { message: "The wrong ROM or no ROM was detected.", type: 'error' },
                id: nanoid(),
              }),
            )
            if (originalState.user.discordUsername !== "") {
              api.dispatch(
                addEvent({
                  event_type: "chat",
                  from_player:-1,
                  to_player: -1,
                  timestamp: Date.now(),
                  event_data: { message: "You are logged in and may send messages.", type: 'info' },
                  id: nanoid(),
                }),
              )
            }
            break
          default:
            console.log("Unknown event type: " + data.type)
            break
        }
      }
      // Try to reconnect if the connection is closed
      socket.onclose = event => {
        if (event.reason !== "") {
          api.dispatch(
            addEvent({
              event_type: "chat",
              from_player:-1,
              to_player: -1,
              timestamp: Date.now(),
              event_data: { message: `Your connection to the server was closed (${event.reason})`, type: 'error' },
              id: nanoid(),
            }))
          return
        } else {
          api.dispatch(
            log(`Connection closed (${event.reason}), reconnecting...`),
          )
          setTimeout(() => {
            api.dispatch(connect())
          }, 1000)
        }
      }
    }
    const currentState = api.getState() as RootState
    if (
      updateMemory.match(action) &&
      !currentState.multiworld.receiving &&
      !currentState.multiworld.sram_updating_on_server
    ) {
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

    if (pauseReceiving.match(action)) {
      api.dispatch(log("Pausing receiving"))
      socket?.send(
        JSON.stringify({
          type: "pause_receiving",
        }),
      )
    }

    if (resumeReceiving.match(action)) {
      if (currentState.multiworld.receiving_paused === false) {
        return next(action)
      }
      api.dispatch(log("Resuming receiving"))
      socket?.send(
        JSON.stringify({
          type: "resume_receiving",
        }),
      )
    }

    if (setPlayerInfo.match(action)) {
      socket?.send(
        JSON.stringify({
          type: "player_info",
          ...action.payload,
        }),
      )
      api.dispatch(setInitComplete(true))
    }

    return next(action)
  }
}
