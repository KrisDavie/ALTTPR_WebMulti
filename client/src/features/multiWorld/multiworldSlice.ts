import { createSlice } from "@reduxjs/toolkit"
import { apiSlice } from "@/features/api/apiSlice"
import { Event } from "@/app/types"

export interface MemoryType {
  [key: string]: number[]
}

export interface MultiworldSliceState {
  sessionId: string
  password: string
  events: Event[]
  file_name: string
  player_type?: "player" | "non_player"
  memory?: MemoryType
  connectionState: "disconnected" | "accepted" | "player_info" | "connected"
  rom_name?: string
  player_id?: number
  receiving?: boolean
  receiving_paused?: boolean
  init_complete?: boolean
  sram_updating_on_server: boolean
}

const initialState: MultiworldSliceState = {
  sessionId: "",
  password: "",
  events: [],
  file_name: "",
  memory: {},
  connectionState: "disconnected",
  rom_name: "",
  player_type: "player",
  player_id: 0,
  receiving: false,
  receiving_paused: false,
  init_complete: false,
  sram_updating_on_server: false,
}

export const multiworldSlice = createSlice({
  name: "multiworld",
  initialState: initialState,
  reducers: {
    connect: () => {},
    send: () => {},
    disconnect: () => {},
    reconnect: (state, action) => {
      state.file_name = action.payload.file_name
      state.rom_name = ""
      state.player_id = 0
      state.connectionState = "disconnected"
    },
    sendPlayerInfo: () => {},
    sendChatMessage: (_state, _action) => {},
    setSession: (state, action) => {
      state.sessionId = action.payload.sessionId
      state.password = action.payload.password || ""
    },
    addEvent: (state, action) => {
      if (action.payload.type === "new_items") {
        state.events.push(...action.payload.data)
      } else {
        state.events.push(action.payload)
      }
    },
    updateMemory: (state, action) => {
      state.memory = action.payload
    },
    pauseReceiving: state => {
      state.receiving_paused = true
    },
    resumeReceiving: state => {
      state.receiving_paused = false
    },
    setPlayerInfo: (state, action) => {
      state.player_id = action.payload.player_id
      state.rom_name = action.payload.rom_name
      state.connectionState = "connected"
    },
    setReceiving: (state, action) => {
      state.receiving = action.payload
    },
    setInitComplete: (state, action) => {
      state.init_complete = action.payload
    },
    setSramUpdatingOnServer: (state, action) => {
      state.sram_updating_on_server = action.payload
    },
    setPlayerType: (state, action) => {
      state.player_type = action.payload
    },
    setConnectionState: (state, action) => {
      state.connectionState = action.payload
    },
    setFileName: (state, action) => {
      state.file_name = action.payload
    }
  },
  extraReducers: builder => {
    builder.addMatcher(
      apiSlice.endpoints.getSessionEvents.matchFulfilled,
      (state, action) => {
        action.payload.forEach(event => {
          event.event_historical = true
          state.events.push(event)
        })
      },
    )
  },
})

export const {
  connect,
  send,
  disconnect,
  reconnect,
  setSession,
  addEvent,
  sendChatMessage,
  pauseReceiving,
  resumeReceiving,
  updateMemory,
  setPlayerInfo,
  setInitComplete,
  setSramUpdatingOnServer,
  sendPlayerInfo,
  setReceiving,
  setPlayerType,
  setConnectionState,  
  setFileName,
} = multiworldSlice.actions

// export const multiworldActions = multiworldSlice.actions
