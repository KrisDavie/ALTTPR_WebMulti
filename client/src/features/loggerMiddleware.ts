import { Middleware, isAction } from "@reduxjs/toolkit"
import { apiSlice } from "@/features/api/apiSlice"
import { log } from "./loggerSlice"

import type { RootState } from "@/app/store"

export const loggerMiddleware: Middleware<{}, RootState> = api => {
  return next => action => {
    if (!isAction(action)) {
      return next(action)
    }

    let originalState = api.getState()

    if (log.match(action)) {
      if (!originalState.logger.enabled) {
        return next(action)
      }
      api.dispatch(
        // @ts-expect-error
        apiSlice.endpoints.sendLogMessage.initiate({
          sessionId: originalState.multiworld.sessionId,
          user_id: originalState.user.id,
          player_id: originalState.multiworld.player_id,
          message: `[${new Date().toLocaleString()}] ${action.payload}`,
        }),
      )
    }
    return next(action)
  }
}
