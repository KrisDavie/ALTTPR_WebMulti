import { createSlice } from "@reduxjs/toolkit"

export interface UserState {
  id: number
  username?: string
  discordUsername?: string
  avatar?: string
}

const initialState: UserState = {
  id: 0,
  username: undefined,
  discordUsername: undefined,
  avatar: undefined,
}

export const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.id = action.payload.id
      state.username = action.payload.username
      state.discordUsername = action.payload.discord_username
      state.avatar = action.payload.avatar
    },
    clearUser: state => {
      state.id = 0
      state.username = undefined
      state.discordUsername = undefined
      state.avatar = undefined
    },
  },
})

export const { setUser, clearUser } = userSlice.actions
export default userSlice.reducer

export const userActions = userSlice.actions
