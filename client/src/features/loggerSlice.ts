import { createSlice } from "@reduxjs/toolkit"

import type { RootState } from "@/app/store"

type SliceState = {
    log: string[]
    enabled: boolean
}

const initialState: SliceState = {
    log: [],
    enabled: true,
}

export const loggerSlice = createSlice({
    name: "logger",
    initialState: initialState,
    reducers: {
        log: (state, action) => {
            if (!state.enabled) return
            state.log.push(`[${new Date().toLocaleString()}] ${action.payload}`);
        },
    },
})

export const { log } = loggerSlice.actions

export const selectLog = (state: RootState) => state.logger.log

export default loggerSlice.reducer
