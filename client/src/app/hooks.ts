// This file serves as a central hub for re-exporting pre-typed Redux hooks.
// These imports are restricted elsewhere to ensure consistent
// usage of typed hooks throughout the application.
// We disable the ESLint rule here because this is the designated place
// for importing and re-exporting the typed versions of hooks.
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "./store"
import { useCallback } from "react"
import { useLazyAuthUserQuery } from "@/features/api/apiSlice"
import { setUser } from "@/features/user/userSlice"

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()

export const useFetchUser = () => {
  const dispatch = useAppDispatch()
  const [authUser, _result] = useLazyAuthUserQuery()

  const fetchUser = useCallback(
    async (authOnly: boolean = false) => {
      try {
        const payload = await authUser({ authOnly: authOnly }).unwrap()
        dispatch(setUser(payload))
      } catch (error) {
        console.error("rejected", error)
      }
    },
    [authUser, dispatch],
  )
  return { fetchUser }
}
