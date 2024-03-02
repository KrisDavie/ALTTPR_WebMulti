import { createSlice } from "@reduxjs/toolkit"
import { apiSlice } from "@/features/api/apiSlice"
import { Event } from "@/app/types"

type SliceState = {
  sessionId: string
  password: string
  events: Event[]
  memory?: string[]
  player_id?: number
  receiving?: boolean
  init_complete?: boolean
}

const initialState: SliceState = {
  sessionId: "",
  password: "",
  events: [],
  memory: [],
  player_id: 0,
  receiving: false,
  init_complete: false,
}

export const multiworldSlice = createSlice({
  name: "multiworld",
  initialState: initialState,
  reducers: {
    connect: state => {},
    send: state => {},
    disconnect: state => {},
    sendPlayerInfo: (state, action) => {},
    setSession: (state, action) => {
      state.sessionId = action.payload.sessionId
      state.password = action.payload.password || ""
    },
    addEvent: (state, action) => {
      console.log(action)
      if (action.payload.type === "new_items") {
        state.events.push(...action.payload.data)
      } else {
        state.events.push(action.payload)
      }
      console.log(state.events)
    },
    updateMemory: (state, action) => {
      state.memory = action.payload
    },
    setPlayerId: (state, action) => {
      state.player_id = action.payload
    },
    setReceiving: (state, action) => {
      state.receiving = action.payload
    },
    setInitComplete: (state, action) => {
      state.init_complete = action.payload
    },
  },
  extraReducers: builder => {
    builder.addMatcher(
      apiSlice.endpoints.getSessionEvents.matchFulfilled,
      (state, action) => {
        action.payload.forEach(event => {
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
  setSession,
  addEvent,
  updateMemory,
  setPlayerId,
  setInitComplete,
  sendPlayerInfo,
  setReceiving,
} = multiworldSlice.actions

// export const multiworldActions = multiworldSlice.actions
