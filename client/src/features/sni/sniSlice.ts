import type { PayloadAction } from "@reduxjs/toolkit"
import { createSlice } from "@reduxjs/toolkit"

export interface SniSliceState {
  grpcHost: string
  grpcPort: number
  grpcConnected: boolean
  deviceList: string[]
  connectedDevice?: string
  memLocation?: number
  memData?: Uint8Array
}

const initialState: SniSliceState = {
  grpcHost: "localhost",
  grpcPort: 8190,
  grpcConnected: false,
  deviceList: [],
  connectedDevice: undefined,
  memLocation: undefined,
  memData: undefined,
}

export const sniSlice = createSlice({
  name: "sni",
  initialState,
  reducers: {
    setGrpcConnected: (state, action: PayloadAction<boolean>) => {
      state.grpcConnected = action.payload
    },
    setMemLocation: (state, action: PayloadAction<number>) => {
      state.memLocation = action.payload
    },

    setMemData: (state, action: PayloadAction<Uint8Array>) => {
      state.memData = action.payload
    },

    setGrpcHost: (state, action: PayloadAction<string>) => {
      state.grpcHost = action.payload
    },
    setGrpcPort: (state, action: PayloadAction<number>) => {
      state.grpcPort = action.payload
    },
    setDeviceList: (state, action: PayloadAction<string[]>) => {
      state.deviceList = action.payload
    },
    setConnectedDevice: (state, action: PayloadAction<string>) => {
      state.connectedDevice = action.payload
    },
  },
})

export const selectAvailableDevices = (state: { sni: SniSliceState }) =>
  state.sni.deviceList

export const {
  setMemLocation,
  setMemData,
  setGrpcHost,
  setGrpcPort,
  setGrpcConnected,
  setDeviceList,
  setConnectedDevice,
} = sniSlice.actions
export default sniSlice.reducer 

export const sniActions = sniSlice.actions