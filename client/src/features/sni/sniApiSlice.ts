import {
  BaseQueryApi,
  createApi,
  fakeBaseQuery,
} from "@reduxjs/toolkit/query/react"
import { GrpcWebFetchTransport } from "@protobuf-ts/grpcweb-transport"
import {
  resetGrpc,
  setConnectedDevice,
  setDeviceList,
  setGrpcConnected,
  shiftQueue,
  SniSliceState,
} from "./sniSlice"
import {
  DevicesClient,
  DeviceControlClient,
  DeviceMemoryClient,
  DeviceInfoClient,
} from "@/sni/sni.client"
import { AddressSpace, MemoryMapping, Field } from "@/sni/sni"
import {
  MultiworldSliceState,
  setPlayerInfo,
  updateMemory,
  setReceiving,
  reconnect,
  resumeReceiving,
  setPlayerType,
  setFileName,
} from "../multiWorld/multiworldSlice"
import { log } from "../loggerSlice"
import type { AppDispatch } from "@/app/store"
import { UserState } from "../user/userSlice"

export const ingame_modes = [0x07, 0x09, 0x0b]
const save_quit_modes = [0x00, 0x01, 0x17, 0x1b]

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
  0xf5f43e: ["total_time", 0x3],
  0xf5f443: ["goal_complete", 0x1],
  0xf5f4d0: ["multiinfo", 0x4],
  0xf66018: ["pots", 0x250],
  0xf66268: ["sprites", 0x250],
  0xf664b8: ["shops", 0x29],
  0xf5f472: ["prizes", 0x2],
}

let receiving_lock = false

const updateReceiving = (dispatch: AppDispatch, receiving_state: boolean) => {
  dispatch(setReceiving(receiving_state))
  receiving_lock = receiving_state
}

interface AccessedState {
  multiworld: MultiworldSliceState
  sni: SniSliceState
  user: UserState
}

const getReceiveState = (state: AccessedState) => {
  return state.multiworld.receiving || receiving_lock
}

const getTransport = (state: AccessedState) => {
  return new GrpcWebFetchTransport({
    baseUrl: `http://${state.sni.grpcHost}:${state.sni.grpcPort}`,
  })
}

const setNonPlayerInfo = (queryApi: BaseQueryApi, user: UserState) => {
  queryApi.dispatch(
    setPlayerInfo({
      player_id: -2,
      rom_name: "non_player",
      user_id: user.id,
      session_token: user.token,
    }),
  )
  queryApi.dispatch(setPlayerType("non_player"))
}

const isCompatibleSeed = (romName: string) => {
  return (
    ["DR", "OR"].includes(romName.slice(0, 2)) &&
    romName.split("_").length === 4
  )
}

export const sniApiSlice = createApi({
  baseQuery: fakeBaseQuery(),
  reducerPath: "sniApi",
  endpoints: builder => ({
    getDevices: builder.query({
      async queryFn(arg: { noConnect: boolean }, queryApi) {
        const transport = getTransport(queryApi.getState() as AccessedState)
        try {
          const devClient = new DevicesClient(transport)
          const devicesReponse = await devClient.listDevices({ kinds: [] })
          const devices = devicesReponse.response.devices.map(
            device => device.uri,
          )
          queryApi.dispatch(setGrpcConnected(true))
          queryApi.dispatch(setDeviceList(devices))
          if (devices.length > 0 && !arg.noConnect) {
            queryApi.dispatch(setConnectedDevice(devices[0]))
          }
          return { data: devices }
        } catch {
          queryApi.dispatch(resetGrpc())
          return { error: "Error getting devices." }
        }
      },
    }),
    reset: builder.mutation({
      async queryFn(arg, queryApi) {
        const state = queryApi.getState() as AccessedState
        const transport = getTransport(state)
        const controlClient = new DeviceControlClient(transport)
        const connectedDevice = state.sni.connectedDevice
        if (connectedDevice) {
          const res = await controlClient.resetSystem({ uri: connectedDevice })
          return { data: res }
        } else {
          return { error: "No device selected" }
        }
      },
    }),

    sendManyItems: builder.mutation({
      async queryFn(_arg: object, queryApi) {
        let state = queryApi.getState() as AccessedState
        const curQueue = [...state.sni.itemQueue]
        if (state.multiworld.receiving_paused) {
          return { error: "Receiving is paused" }
        }
        if (curQueue.length === 0) {
          return { error: "No items to send" }
        }
        if (getReceiveState(state)) {
          return { error: "Already receiving" }
        }
        updateReceiving(queryApi.dispatch, true)

        const transport = getTransport(state)
        const controlMem = new DeviceMemoryClient(transport)
        const connectedDevice = state.sni.connectedDevice
        if (!connectedDevice) {
          updateReceiving(queryApi.dispatch, false)
          return { error: "No device or memory data" }
        }

        // We wait until receiving is set before actually sending items
        queryApi.dispatch(
          log(
            `Sending ${curQueue.length} items. Waiting for state to be done receiving and to be in game...`,
          ),
        )
        let game_mode = 0x00

        while (!getReceiveState(state) || !ingame_modes.includes(game_mode)) {
          const game_mode_response = await controlMem.singleRead({
            uri: connectedDevice,
            request: {
              requestMemoryMapping: MemoryMapping.LoROM,
              requestAddress: parseInt("f50010", 16),
              requestAddressSpace: AddressSpace.FxPakPro,
              size: 1,
            },
          })
          if (!game_mode_response.response.response) {
            updateReceiving(queryApi.dispatch, false)
            return { error: "Error reading memory, no reposonse" }
          }
          game_mode = game_mode_response.response.response.data[0]

          await new Promise(r => setTimeout(r, 250))
          state = queryApi.getState() as AccessedState
        }
        queryApi.dispatch(
          log(`Done Receiving and in game. Sending ${curQueue.length} items`),
        )

        let writeResponse
        // for (let i = 0; i < arg.memVals.length; i++) {
        state = queryApi.getState() as AccessedState
        while (state.sni.itemQueue.length > 0) {
          state = queryApi.getState() as AccessedState
          if (state.multiworld.receiving_paused) {
            await new Promise(r => setTimeout(r, 500))
            continue
          }
          const memVal = state.sni.itemQueue[0]
          if (!memVal) {
            continue
          }
          const event_idx = memVal.event_idx[0] * 256 + memVal.event_idx[1]
          queryApi.dispatch(shiftQueue())
          let last_item_id = 255
          let last_event_idx = 0

          // Wait for the player to finish receiving before sending the next item
          while (last_item_id != 0) {
            const readCurItem = await controlMem.singleRead({
              uri: connectedDevice,
              request: {
                requestMemoryMapping: MemoryMapping.LoROM,
                requestAddress: parseInt("f5f4d0", 16),
                requestAddressSpace: AddressSpace.FxPakPro,
                size: 3,
              },
            })
            if (!readCurItem.response.response) {
              return { error: "Error reading memory, no reposonse" }
            }
            last_item_id = readCurItem.response.response.data[2]
            last_event_idx =
              readCurItem.response.response.data[0] * 256 +
              readCurItem.response.response.data[1]
            if (last_item_id === 0) {
              if (last_event_idx === 0) {
                // This should never be 0, but the rom sometimes sets it to 0 when changing state
                // Wait for it to be a real value again
                continue
              }
              queryApi.dispatch(
                log(`Previous item finished, index was ${last_event_idx}`),
              )
              break
            }
            await new Promise(r => setTimeout(r, 250))
          }

          // Get index of current item and make sure it's greater than the last one so we don't resend any items
          if (event_idx !== last_event_idx + 1) {
            queryApi.dispatch(
              log(
                `Skipping item ${event_idx} as it is not the next event after ${last_event_idx}`,
              ),
            )
            await new Promise(r => setTimeout(r, 50))
            continue
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

          queryApi.dispatch(
            log(
              `Done sending item ${memVal.event_data?.item_name}. Getting new state.`,
            ),
          )
        }

        // Here we're just going to wait a little bit after sending the last item before then updating the state
        await new Promise(r => setTimeout(r, 1000))
        updateReceiving(queryApi.dispatch, false)
        queryApi.dispatch(log(`Completed sending items`))
        return { data: writeResponse?.response.response?.requestAddress }
      },
    }),
    readSRAM: builder.query({
      async queryFn(arg: { noPots?: boolean; noEnemies?: boolean }, queryApi) {
        const state = queryApi.getState() as AccessedState
        const transport = getTransport(state)
        const controlMem = new DeviceMemoryClient(transport)
        const controlDev = new DeviceInfoClient(transport)
        const connectedDevice = state.sni.connectedDevice
        const connectionState = state.multiworld.connectionState
        const user = state.user

        // This action is responsible for most of the multiworld logic
        // We need to see if we are connected to a proper rom and if we are in game
        // There are several possibilities regarding connections
        // 1. The user doesn't have SNI open
        // 2. The user has SNI open but no device available
        // 3. The user has SNI open and a device available but not connected to a rom
        // 4. The user has SNI open and a device available and connected to a rom, but not the right one
        // 5. The user has SNI open and a device available and connected to the correct rom

        // This covers 1. and 2.
        if (!connectedDevice) {
          // No device
          if (user.discordUsername && connectionState == "player_info") {
            setNonPlayerInfo(queryApi, user)
          }
          return { error: "No device selected" }
        }

        // ================== ROM Checks (Loaded File) ==================
        // This is needed because an FxPak doesn't clear memory assocaited with the ROM name in memory when switching between ROMs
        // We can't _just_ rely on this because 2 different ROMs could share the same file name (i.e. MSUs)
        let fileName

        try {
          fileName = (
            await controlDev.fetchFields({
              uri: connectedDevice,
              fields: [Field.RomFileName],
            })
          ).response.values[0]
        } catch (e) {
          if (
            connectionState === "connected" &&
            state.multiworld.player_type === "player"
          ) {
            queryApi.dispatch(
              reconnect({ fileName: "", reason: "Error getting ROM info" }),
            )
          } else if (connectionState !== "connected") {
            // Covers 3.
            setNonPlayerInfo(queryApi, user)
          }
          return { error: `Error getting ROM info: ${e}` }
        }

        if (!fileName) {
          return { error: "Error getting ROM info" }
        }

        if (
          fileName !== state.multiworld.file_name &&
          connectionState === "connected"
        ) {
          queryApi.dispatch(
            reconnect({ fileName: fileName, reason: "Loaded file changed" }),
          )
          return { error: "Rom changed" }
        }

        queryApi.dispatch(setFileName(fileName))


        // ============= Finshed receiving =============
        // Safety check to make sure we're done receiving at the cost of some latency
        let last_item_id = 255
        while (last_item_id > 0) {
          const readResponse = await controlMem.singleRead({
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
          // This timeout should be at least double the timeout for the sending code
          // TODO:  turn this into a variable
          await new Promise(r => setTimeout(r, 550))
        }

        // ============= Read SRAM =============
        // Read all the memory locations we want
        const requests = []
        for (const [loc, [name, size]] of Object.entries(sram_locs)) {
          if (
            (name === "pots" && arg.noPots) ||
            (name === "sprites" && arg.noEnemies)
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
        const multiReadResponse = await controlMem.multiRead({
          uri: connectedDevice,
          requests: requests,
        })

        if (!multiReadResponse.response.responses) {
          return { error: "Error reading memory, no reposonse" }
        }

        const sram = {} as { [key: string]: number[] }
        multiReadResponse.response.responses.forEach(res => {
          sram[sram_locs[res.requestAddress][0]] = Array.from(res.data)
        })

        // ============= ROM Checks Memory =============
        const romName = sram["rom_name"]
          .map(byte => String.fromCharCode(byte))
          .join("")

        if (!romName || !isCompatibleSeed(romName)) {
          // Covers 4.
          setNonPlayerInfo(queryApi, user)
          return { error: "Incompatible ROM" }
        }

        if (
          state.multiworld.rom_name &&
          romName !== state.multiworld.rom_name
        ) {
          queryApi.dispatch(
            reconnect({ fileName: "", reason: "ROM name changed" }),
          )
          return { error: "Rom changed" }
        }

        if (
          state.multiworld.player_id !== undefined &&
          state.multiworld.player_id <= 0
        ) {
          const player_id = romName.split("_")[2]
          let player_info = {
            rom_name: romName,
            player_id: parseInt(player_id),
            player_name: "Player " + player_id,
            user_id: 0,
            session_token: "",
          }

          if (user && user.token) {
            player_info = {
              ...player_info,
              user_id: user.id,
              session_token: user.token,
            }
          }
          // Covers 5.
          queryApi.dispatch(setPlayerInfo(player_info))
          queryApi.dispatch(setPlayerType('player'))
        }
        if (!ingame_modes.includes(sram["game_mode"][0])) {
          if (save_quit_modes.includes(sram["game_mode"][0])) {
            queryApi.dispatch(resumeReceiving())
          }
          return { error: "Not in game" }
        }

        if (state.multiworld.init_complete) {
          queryApi.dispatch(updateMemory(sram))
        }

        return { data: sram }
      },
    }),
  }),
})

export const {
  useGetDevicesQuery,
  useLazyGetDevicesQuery,
  useResetMutation,
  useReadSRAMQuery,
  useSendManyItemsMutation,
} = sniApiSlice
