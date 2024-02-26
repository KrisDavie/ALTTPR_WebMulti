import { createSlice } from "@reduxjs/toolkit"

type SliceState = {
  sessionId: string
  password: string
  events: string[]
  memory?: string[]
  player_id?: number

}

const initialState: SliceState = {
  sessionId: "",
  password: "",
  events: [],
  memory: [],
  player_id: 0
}

export const multiworldSlice = createSlice({
  name: "multiworld",
  initialState: initialState,
  reducers: {
    connect: state => {},
    send: state => {},
    disconnect: state => {},
    sendPlayerInfo:  (state, action) => {},
    setSession: (state, action) => {
      state.sessionId = action.payload.sessionId
      state.password = action.payload.password || ""
    },
    addEvent: (state, action) => {
      state.events.push(action.payload)
    },
    updateMemory: (state, action) => {
      state.memory = action.payload
    },
    setPlayerId: (state, action) => {
      state.player_id = action.payload
    }
  },
})

export const { connect, send, disconnect, setSession, updateMemory, setPlayerId, sendPlayerInfo } = multiworldSlice.actions

// export const multiworldActions = multiworldSlice.actions
