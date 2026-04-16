import { createSlice } from "@reduxjs/toolkit"
import { apiSlice } from "@/features/api/apiSlice"
import { Event } from "@/app/types"
import { IFeatures } from "../dashboard/MultiworldSessions"

export interface MemoryType {
  [key: string]: number[]
}

export interface MultiworldSliceState {
  sessionId: string
  password: string
  events: Event[]
  file_name: string
  flags: IFeatures
  player_type?: "player" | "non_player"
  memory?: MemoryType
  connectionState: "disconnected" | "accepted" | "player_info" | "connected"
  rom_name?: string
  player_id?: number
  receiving?: boolean
  receiving_paused?: boolean
  init_complete?: boolean
  sram_updating_on_server: boolean
  readyCheckActive: boolean
  readyCheckTimestamp: number | null
  readyPlayers: number[]
}

const initialState: MultiworldSliceState = {
  sessionId: "",
  password: "",
  events: [],
  file_name: "",
  flags: {
    chat: false,
    pauseRecieving: false,
    missingCmd: false,
    duping: false,
    forfeit: false,
  },
  memory: {},
  connectionState: "disconnected",
  rom_name: "",
  player_type: "player",
  player_id: 0,
  receiving: false,
  receiving_paused: false,
  init_complete: false,
  sram_updating_on_server: false,
  readyCheckActive: false,
  readyCheckTimestamp: null,
  readyPlayers: [],
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
    syncPauseState: (state, action) => {
      state.receiving_paused = action.payload
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
    },
    setFlags: (state, action) => {
      state.flags = action.payload
    },
    startReadyCheck: (state, action) => {
      state.readyCheckActive = true
      state.readyCheckTimestamp = action.payload
      state.readyPlayers = []
    },
    addReadyPlayer: (state, action) => {
      if (!state.readyPlayers.includes(action.payload)) {
        state.readyPlayers.push(action.payload)
      }
    },
    removeReadyPlayer: (state, action) => {
      state.readyPlayers = state.readyPlayers.filter(p => p !== action.payload)
    },
    sendReadyResponse: () => {},
    sendUnreadyResponse: () => {},
    clearReadyCheck: (state) => {
      state.readyCheckActive = false
      state.readyCheckTimestamp = null
      state.readyPlayers = []
    },
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
  setFlags,
  setPlayerType,
  setConnectionState,  
  setFileName,
  startReadyCheck,
  addReadyPlayer,
  removeReadyPlayer,
  sendReadyResponse,
  sendUnreadyResponse,
  clearReadyCheck,
  syncPauseState,
} = multiworldSlice.actions

// export const multiworldActions = multiworldSlice.actions
