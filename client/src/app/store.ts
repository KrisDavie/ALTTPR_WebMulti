import { configureStore, ThunkAction, Action, combineReducers } from "@reduxjs/toolkit"
import { sniSlice } from "../features/sni/sniSlice"
import { sniApiSlice } from "@/features/sni/sniApiSlice"
import { apiSlice } from "@/features/api/apiSlice"
import { multiworldSlice } from "@/features/multiWorld/multiworldSlice"
import { multiworldMiddleware } from "@/features/multiWorld/multiworldMiddleware"

const rootReducer = combineReducers({
  sni: sniSlice.reducer,
  multiworld: multiworldSlice.reducer,
  [sniApiSlice.reducerPath]: sniApiSlice.reducer,
  [apiSlice.reducerPath]: apiSlice.reducer,
})

export const store = configureStore({
  reducer: rootReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware()
      .concat(multiworldMiddleware)
      .concat(apiSlice.middleware)
      .concat(sniApiSlice.middleware),

})
export type AppDispatch = typeof store.dispatch
export type RootState = ReturnType<typeof rootReducer>
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>
