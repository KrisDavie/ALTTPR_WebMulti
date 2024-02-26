import type { RootState } from "@/app/store"
import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react"
import { GrpcWebFetchTransport } from "@protobuf-ts/grpcweb-transport"
import {
  setConnectedDevice,
  setDeviceList,
  setGrpcConnected,
  setMemData,
} from "./sniSlice"
import {
  DevicesClient,
  DeviceControlClient,
  DeviceMemoryClient,
} from "@/sni/sni.client"
import { AddressSpace, ReadMemoryRequest } from "@/sni/sni"
import { setPlayerId, updateMemory } from "../multiWorld/multiworldSlice"
import { parse } from "path"

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
  0xf5f410: ["npcs", 0x2],
  0xf5f3c6: ["misc", 0x4],
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
          return { error: e }
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
    sendMemory: builder.mutation({
      async queryFn(
        arg: { memLoc: string; memVal: any },
        queryApi,
        extraOptions,
        baseQuery,
      ) {
        const state = queryApi.getState() as RootState
        const transport = getTransport(state)
        let controlMem = new DeviceMemoryClient(transport)
        let connectedDevice = state.sni.connectedDevice
        if (!connectedDevice) {
          return { error: "No device or memory data" }
        }
        let memMapping = await controlMem.mappingDetect({
          uri: connectedDevice,
        })
        let memoryMapping = memMapping.response.memoryMapping
        let memMappingResponse = await controlMem.singleWrite({
          uri: connectedDevice,
          request: {
            requestMemoryMapping: memoryMapping,
            // requestAddress: parseInt(arg.memLoc, 16),
            requestAddress: parseInt("f5f4d0", 16),
            requestAddressSpace: AddressSpace.FxPakPro,
            data: new Uint8Array([
              0,
              1,
              arg.memVal.item_id,
              arg.memVal.from_player,
            ]),
          },
        })
        return { data: memMappingResponse.response.response?.requestAddress }
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
        let memMapping = await controlMem.mappingDetect({
          uri: connectedDevice,
        })
        let memoryMapping = memMapping.response.memoryMapping
        let memMappingResponse = await controlMem.singleRead({
          uri: connectedDevice,
          request: {
            requestMemoryMapping: memoryMapping,
            requestAddress: parseInt(arg.memLoc, 16),
            requestAddressSpace: AddressSpace.FxPakPro,
            size: arg.size,
          },
        })
        if (!memMappingResponse.response.response) {
          return { error: "Error readin memory, no reposonse" }
        }
        return {
          requestAddress: memMappingResponse.response.response.requestAddress,
          data: Array.from(memMappingResponse.response.response.data), // Convert Uint8Array to Array to be able to serialize
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
        let memMapping = await controlMem.mappingDetect({
          uri: connectedDevice,
        })
        let memoryMapping = memMapping.response.memoryMapping

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
            requestMemoryMapping: memoryMapping,
            requestAddress: parseInt(loc),
            requestAddressSpace: AddressSpace.FxPakPro,
            size: size,
          })
        }

        let memMappingResponse = await controlMem.multiRead({
          uri: connectedDevice,
          requests: requests,
        })

        if (!memMappingResponse.response.responses) {
          return { error: "Error reading memory, no reposonse" }
        }

        let sram = {} as { [key: string]: number[] }
        memMappingResponse.response.responses.forEach(res => {
          sram[sram_locs[res.requestAddress][0]] = Array.from(res.data)
        })

        if (
          !ingame_modes.includes(
            sram["game_mode"][0],
          )
        ) {
          return { error: "Not in game" }
        }

        queryApi.dispatch(updateMemory(sram))

        // check if rom_arr is all 0xff
        if (
          sram["rom_name"] &&
          !sram["rom_name"].every(byte => byte === 0xff) &&
          state.multiworld.player_id === 0
        ) {
          const player_id = sram["rom_name"]
            .map(byte => String.fromCharCode(byte))
            .join("")
            .split("_")[2]
          queryApi.dispatch(setPlayerId(parseInt(player_id)))
        }
        return {
          data: memMappingResponse.response.responses.map(res => {
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
