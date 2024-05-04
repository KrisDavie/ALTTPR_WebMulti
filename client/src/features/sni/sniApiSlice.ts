import type { RootState } from "@/app/store"
import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react"
import { GrpcWebFetchTransport } from "@protobuf-ts/grpcweb-transport"
import { setConnectedDevice, setDeviceList, setGrpcConnected } from "./sniSlice"
import {
  DevicesClient,
  DeviceControlClient,
  DeviceMemoryClient,
} from "@/sni/sni.client"
import { AddressSpace, MemoryMapping } from "@/sni/sni"
import {
  setPlayerInfo,
  updateMemory,
  setReceiving,
  reconnect,
} from "../multiWorld/multiworldSlice"

const getTransport = (state: any) => {
  return new GrpcWebFetchTransport({
    baseUrl: `http://${state.sni.grpcHost}:${state.sni.grpcPort}`,
  })
}

const hexStringToU8Arr = (hexString: string) => {
  const bytes = hexString.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16))
  return bytes ? Uint8Array.from(bytes) : new Uint8Array(0)
}

const ingame_modes = [0x07, 0x09, 0x0b]

type SRAMLocs = {
  [key: number]: [string, number]
}

const sram_locs: SRAMLocs = {
  0xf50010: ["game_mode", 0x1],
  0xe02000: ["rom_name", 0x15],
  // 0xE02000: ["player_name", 0x15],
  0xf5f000: ["base", 0x256],
  0xf5f280: ["overworld", 0x82],
  0xf5f340: ["inventory", 0x1bd],
  0xf5f3c6: ["misc", 0x4],
  0xf5f410: ["npcs", 0x2],
  0xf5f4d0: ["multiinfo", 0x4],
  0xf66018: ["pots", 0x250],
  0xf66268: ["sprites", 0x250],
  0xf664b8: ["shops", 0x29],
}

export const sniApiSlice = createApi({
  baseQuery: fakeBaseQuery(),
  reducerPath: "sniApi",
  endpoints: builder => ({
    getDevices: builder.query({
      async queryFn(
        arg: { noConnect: boolean },
        queryApi,
        extraOptions,
        baseQuery,
      ) {
        const transport = getTransport(queryApi.getState() as RootState)
        try {
          let devClient = new DevicesClient(transport)
          let devicesReponse = await devClient.listDevices({ kinds: [] })
          let devices = devicesReponse.response.devices.map(
            device => device.uri,
          )
          queryApi.dispatch(setGrpcConnected(true))
          queryApi.dispatch(setDeviceList(devices))
          if (devices.length > 0 && !arg.noConnect) {
            queryApi.dispatch(setConnectedDevice(devices[0]))
          }
          return { data: devices }
        } catch (e) {
          return { error: "Error getting devices." }
        }
      },
    }),
    reset: builder.mutation({
      async queryFn(arg, queryApi, extraOptions, baseQuery) {
        const state = queryApi.getState() as RootState
        const transport = getTransport(state)
        let controlClient = new DeviceControlClient(transport)
        let connectedDevice = state.sni.connectedDevice
        if (connectedDevice) {
          const res = await controlClient.resetSystem({ uri: connectedDevice })
          return { data: res }
        } else {
          return { error: "No device selected" }
        }
      },
    }),

    sendManyItems: builder.mutation({
      async queryFn(arg: { memVals: any }, queryApi, extraOptions, baseQuery) {
        queryApi.dispatch(setReceiving(true))
        const state = queryApi.getState() as RootState
        const transport = getTransport(state)
        let controlMem = new DeviceMemoryClient(transport)
        let connectedDevice = state.sni.connectedDevice
        if (!connectedDevice) {
          return { error: "No device or memory data" }
        }
        let writeResponse
        for (let i = 0; i < arg.memVals.length; i++) {
          let last_item_id = 255
          let memVal = arg.memVals[i]
          while (last_item_id > 0) {
            let readCurItem = await controlMem.singleRead({
              uri: connectedDevice,
              request: {
                requestMemoryMapping: MemoryMapping.LoROM,
                requestAddress: parseInt("f5f4d2", 16),
                requestAddressSpace: AddressSpace.FxPakPro,
                size: 1,
              },
            })
            if (!readCurItem.response.response) {
              return { error: "Error reading memory, no reposonse" }
            }
            last_item_id = readCurItem.response.response.data[0]
            if (last_item_id === 0) {
              break
            }
            await new Promise(r => setTimeout(r, 250))
          }

          writeResponse = await controlMem.singleWrite({
            uri: connectedDevice,
            request: {
              requestMemoryMapping: MemoryMapping.LoROM,
              requestAddress: parseInt("f5f4d0", 16),
              requestAddressSpace: AddressSpace.FxPakPro,
              data: new Uint8Array([
                memVal.event_idx[0],
                memVal.event_idx[1],
                memVal.item_id,
                memVal.from_player,
              ]),
            },
          })
        }
        queryApi.dispatch(setReceiving(false))
        return { data: writeResponse?.response.response?.requestAddress }
      },
    }),
    sendMemory: builder.mutation({
      async queryFn(
        arg: { memLoc: string; memVal: any },
        queryApi,
        extraOptions,
        baseQuery,
      ) {
        queryApi.dispatch(setReceiving(true))
        const state = queryApi.getState() as RootState
        const transport = getTransport(state)
        let controlMem = new DeviceMemoryClient(transport)
        let connectedDevice = state.sni.connectedDevice
        if (!connectedDevice) {
          return { error: "No device or memory data" }
        }
        let last_item_id = 255
        while (last_item_id > 0) {
          let readResponse = await controlMem.singleRead({
            uri: connectedDevice,
            request: {
              requestMemoryMapping: MemoryMapping.LoROM,
              requestAddress: parseInt("f5f4d2", 16),
              requestAddressSpace: AddressSpace.FxPakPro,
              size: 1,
            },
          })
          if (!readResponse.response.response) {
            return { error: "Error reading memory, no reposonse" }
          }
          last_item_id = readResponse.response.response.data[0]
          if (last_item_id === 0) {
            break
          }
          await new Promise(r => setTimeout(r, 250))
        }

        let writeReponse = await controlMem.singleWrite({
          uri: connectedDevice,
          request: {
            requestMemoryMapping: MemoryMapping.LoROM,
            requestAddress: parseInt(arg.memLoc, 16),
            // requestAddress: parseInt("f5f4d0", 16),
            requestAddressSpace: AddressSpace.FxPakPro,
            data: new Uint8Array([
              arg.memVal.event_idx[0],
              arg.memVal.event_idx[1],
              arg.memVal.item_id,
              arg.memVal.from_player,
            ]),
          },
        })
        queryApi.dispatch(setReceiving(false))

        return { data: writeReponse.response.response?.requestAddress }
      },
    }),
    readMemory: builder.query({
      async queryFn(
        arg: { memLoc: string; size: number },
        queryApi,
        extraOptions,
        baseQuery,
      ) {
        const state = queryApi.getState() as RootState
        const transport = getTransport(state)
        let controlMem = new DeviceMemoryClient(transport)
        let connectedDevice = state.sni.connectedDevice
        if (!connectedDevice) {
          return { error: "No device selected" }
        }

        let readResponse = await controlMem.singleRead({
          uri: connectedDevice,
          request: {
            requestMemoryMapping: MemoryMapping.LoROM,
            requestAddress: parseInt(arg.memLoc, 16),
            requestAddressSpace: AddressSpace.FxPakPro,
            size: arg.size,
          },
        })
        if (!readResponse.response.response) {
          return { error: "Error reading memory, no reposonse" }
        }
        return {
          requestAddress: readResponse.response.response.requestAddress,
          data: Array.from(readResponse.response.response.data), // Convert Uint8Array to Array to be able to serialize
        }
      },
    }),
    readSRAM: builder.query({
      async queryFn(
        arg: { noPots?: boolean; noEnemies?: boolean },
        queryApi,
        extraOptions,
        baseQuery,
      ) {
        const state = queryApi.getState() as RootState
        const transport = getTransport(state)
        let controlMem = new DeviceMemoryClient(transport)
        let connectedDevice = state.sni.connectedDevice
        if (!connectedDevice) {
          return { error: "No device selected" }
        }
        let requests = []
        for (let [loc, [name, size]] of Object.entries(sram_locs)) {
          if (
            (name === "pots" && arg.noPots) ||
            (name === "sprites" && arg.noEnemies) ||
            (name === "rom_name" && state.multiworld.player_id !== 0)
            // (name === "rom_name" && state.multiworld.player_id !== 0)
          ) {
            continue
          }
          requests.push({
            requestMemoryMapping: MemoryMapping.LoROM,
            requestAddress: parseInt(loc),
            requestAddressSpace: AddressSpace.FxPakPro,
            size: size,
          })
        }

        let multiReadResponse = await controlMem.multiRead({
          uri: connectedDevice,
          requests: requests,
        })

        if (!multiReadResponse.response.responses) {
          return { error: "Error reading memory, no reposonse" }
        }

        let sram = {} as { [key: string]: number[] }
        multiReadResponse.response.responses.forEach(res => {
          sram[sram_locs[res.requestAddress][0]] = Array.from(res.data)
        })

        // Rom has changed, reconnect the websocket
        if (
          state.multiworld.rom_name &&
          sram["rom_name"] &&
          ['DR', 'OR'].includes(sram["rom_name"].slice(0, 2).map(byte => String.fromCharCode(byte)).join("")) &&
          sram["rom_name"]
            .map(byte => String.fromCharCode(byte))
            .join("")
            .split("_")[2] !== state.multiworld.rom_name
        ) {
          queryApi.dispatch(reconnect())
          return { error: "Rom changed" }
        }

        // TODO: Add a check for it the rom changes and restart the websocket connection with the new playerID

        // check if rom_arr is all 0xff
        if (
          sram["rom_name"] &&
          ['DR', 'OR'].includes(sram["rom_name"].slice(0, 2).map(byte => String.fromCharCode(byte)).join("")) &&
          state.multiworld.player_id === 0
        ) {
          const player_id = sram["rom_name"]
            .map(byte => String.fromCharCode(byte))
            .join("")
            .split("_")[2]
          queryApi.dispatch(
            setPlayerInfo({
              rom_name: sram["rom_name"],
              player_id: parseInt(player_id),
            }),
          )
        }

        if (!ingame_modes.includes(sram["game_mode"][0])) {
          return { error: "Not in game" }
        }

        if (state.multiworld.init_complete) {
          queryApi.dispatch(updateMemory(sram))
        }
        
        return {
          data: multiReadResponse.response.responses.map(res => {
            return {
              name: sram_locs[res.requestAddress][0],
              data: Array.from(res.data), // Convert Uint8Array to Array to be able to serialize
            }
          }),
        }
      },
    }),
  }),
})

export const {
  useGetDevicesQuery,
  useLazyGetDevicesQuery,
  useResetMutation,
  useSendMemoryMutation,
  useReadMemoryQuery,
  useReadSRAMQuery,
} = sniApiSlice
