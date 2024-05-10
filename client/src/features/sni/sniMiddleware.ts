import { Middleware, isAction } from "@reduxjs/toolkit"
import { GrpcWebFetchTransport } from "@protobuf-ts/grpcweb-transport"
import { sniActions, setConnectedDevice, setDeviceList } from "./sniSlice"
import { DevicesClient, DeviceControlClient, DeviceMemoryClient,  } from "@/sni/sni.client"
import { AddressSpace, DetectMemoryMappingResponse, MemoryMapping } from "@/sni/sni"
import { Buffer } from "buffer"

// TODO: This should not be a middleware, but should just use RTK - 
// each action is independent with no persistent state

import type { RootState } from "@/app/store"

// const hexStringToU8Arr = (hexString: string) => {
//   const bytes = hexString.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16));
//   return bytes ? Uint8Array.from(bytes) : new Uint8Array(0);
// }

export const sniMiddleware: Middleware<{}, RootState> =
  (api) => (next) => async (action) => {
    const result = next(action);
    if (!isAction(action)) {
      return result
    }

    let originalState = api.getState()
    let transport = new GrpcWebFetchTransport({
      baseUrl: `http://${originalState.sni.grpcHost}:${originalState.sni.grpcPort}`,
    })

    switch (action.type) {
      case "sni/connect":
        let devClient = new DevicesClient(transport)
        let devicesReponse = await devClient.listDevices({ kinds: [] })
        let devices = devicesReponse.response.devices.map(device => device.uri)
        api.dispatch(setDeviceList(devices))
        api.dispatch(setConnectedDevice(devices[0]))
        break
      case "sni/reset":
        let controlClient = new DeviceControlClient(transport)
        originalState.sni.connectedDevice && await controlClient.resetSystem({ uri: originalState.sni.connectedDevice })
        break
    }
    return result
  }
