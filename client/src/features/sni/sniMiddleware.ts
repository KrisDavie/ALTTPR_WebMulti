import { Middleware, isAction } from "@reduxjs/toolkit"
import { GrpcWebFetchTransport } from "@protobuf-ts/grpcweb-transport"
import { setConnectedDevice, setDeviceList } from "./sniSlice"
import { DevicesClient } from "@/sni/sni.client"

// TODO: This should not be a middleware, but should just use RTK -
// each action is independent with no persistent state

import type { RootState } from "@/app/store"


export const sniMiddleware: Middleware<object, RootState> =
  api => next => async action => {
    const result = next(action)
    if (!isAction(action)) {
      return result
    }

    const originalState = api.getState()
    const transport = new GrpcWebFetchTransport({
      baseUrl: `http://${originalState.sni.grpcHost}:${originalState.sni.grpcPort}`,
    })

    switch (action.type) {
      case "sni/connect": {
        const devClient = new DevicesClient(transport)
        const devicesReponse = await devClient.listDevices({ kinds: [] })
        const devices = devicesReponse.response.devices.map(
          device => device.uri,
        )
        api.dispatch(setDeviceList(devices))
        api.dispatch(setConnectedDevice(devices[0]))
        break
      }
    }
    return result
  }
