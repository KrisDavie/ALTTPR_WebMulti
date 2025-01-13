import { createSlice } from "@reduxjs/toolkit"

export interface UserState {
  id: number
  username?: string
  discordDisplayName?: string
  discordUsername?: string
  usernameAsPlayerName?: boolean
  avatar?: string
  superUser?: boolean
  bots: UserState[]
  bot?: boolean
  api_keys?: APIKey[]
}

export interface APIKey {
  id: number
  description: string
  last_used: string
  created_at: string
}

const initialState: UserState = {
  id: 0,
  username: undefined,
  discordDisplayName: undefined,
  discordUsername: undefined,
  usernameAsPlayerName: false,
  avatar: undefined,
  superUser: false,
  bot: undefined,
  bots: [],
}

export const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.id = action.payload.id
      state.username = action.payload.username
      state.discordDisplayName = action.payload.discord_display_name
      state.discordUsername = action.payload.discord_username
      state.usernameAsPlayerName = action.payload.username_as_player_name
      state.avatar = action.payload.avatar
      state.superUser = action.payload.is_superuser
      state.bot = action.payload.is_bot
      state.bots = action.payload.bots
      
    },
    clearUser: state => {
      state.id = 0
      state.username = undefined
      state.discordDisplayName = undefined
      state.discordUsername = undefined
      state.usernameAsPlayerName = false
      state.avatar = undefined
      state.superUser = false
      state.bot = undefined
      state.bots = []
    },
  },
})

export const { setUser, clearUser } = userSlice.actions
export default userSlice.reducer

export const userActions = userSlice.actions
