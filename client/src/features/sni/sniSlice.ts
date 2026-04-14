import { Event, ItemEvent } from "@/app/types"
import type { PayloadAction } from "@reduxjs/toolkit"
import { createSlice } from "@reduxjs/toolkit"
import { DeviceCapability } from "@/sni/sni"

export interface DeviceInfo {
  uri: string
  displayName: string
  kind: string
  capabilities: DeviceCapability[]
}

export interface SniSliceState {
  grpcHost: string
  grpcPort: number
  grpcConnected: boolean
  deviceList: string[]
  deviceCapabilities: Record<string, DeviceCapability[]>
  connectedDevice?: string
  itemQueue: ItemEvent[]
}

const initialState: SniSliceState = {
  grpcHost: "localhost",
  grpcPort: 8190,
  grpcConnected: false,
  deviceList: [],
  deviceCapabilities: {},
  connectedDevice: undefined,
  itemQueue: [],
}

export const sniSlice = createSlice({
  name: "sni",
  initialState,
  reducers: {
    setGrpcConnected: (state, action: PayloadAction<boolean>) => {
      state.grpcConnected = action.payload
    },
    setGrpcHost: (state, action: PayloadAction<string>) => {
      state.grpcHost = action.payload
    },
    addItemsToQueue: (state, action: PayloadAction<ItemEvent[]>) => {
      state.itemQueue = [...state.itemQueue, ...action.payload].sort(
        (a: ItemEvent, b: ItemEvent) =>
          (a.event_idx[0] * 256 +
          a.event_idx[1]) -
          (b.event_idx[0] * 256 + b.event_idx[1]),
      ).reduce((acc: ItemEvent[], x: ItemEvent) => {
        if (!acc.some((item: Event) => item.id === x.id)) {
          acc.push(x)
        }
        return acc
      }, [])
    },
    resetGrpc: (state) => {
      state.grpcConnected = false
      state.deviceList = []
      state.deviceCapabilities = {}
      state.connectedDevice = undefined
    },
    shiftQueue: (state) => {
      state.itemQueue.shift()
    },
    setGrpcPort: (state, action: PayloadAction<number>) => {
      state.grpcPort = action.payload
    },
    setDeviceList: (state, action: PayloadAction<string[]>) => {
      state.deviceList = action.payload
    },
    setDeviceCapabilities: (state, action: PayloadAction<Record<string, DeviceCapability[]>>) => {
      state.deviceCapabilities = action.payload
    },
    setConnectedDevice: (state, action: PayloadAction<string>) => {
      state.connectedDevice = action.payload
    },
  },
})

export const selectAvailableDevices = (state: { sni: SniSliceState }) =>
  state.sni.deviceList

export const selectDeviceCapabilities = (state: { sni: SniSliceState }, uri?: string) =>
  uri ? (state.sni.deviceCapabilities[uri] ?? []) : []

export const {
  setGrpcHost,
  setGrpcPort,
  setGrpcConnected,
  setDeviceList,
  setDeviceCapabilities,
  resetGrpc,
  setConnectedDevice,
  addItemsToQueue,
  shiftQueue,
} = sniSlice.actions
export default sniSlice.reducer 

export const sniActions = sniSlice.actions