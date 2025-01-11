import { Params, useLoaderData } from "react-router-dom"
import MultiEventViewer from "./MultiEventViewer"
import { useAppDispatch, useAppSelector } from "@/app/hooks"
import { connect, setSession } from "./multiworldSlice"
import { useGetSessionQuery, useSendForfeitMutation} from "../api/apiSlice"
import ItemSender from "./ItemSender"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import PauseReceivingPanel from "./PauseReceivingPanel"

export function loader({ params }: { params: Params }) {
  return { sessionId: params.sessionId }
}


function MultiView() {
  const dispatch = useAppDispatch()
  const playerId = useAppSelector(state => state.multiworld.player_id)
  const user = useAppSelector(state => state.user)
  const { sessionId } = useLoaderData() as { sessionId: string }
  const [adminMode, setAdminMode] = useState(false)
  const { data: session, isLoading: sessionLoading } = useGetSessionQuery(sessionId)
  const [sendForfeit, sendForfeitResult] = useSendForfeitMutation()

  useEffect(() => {
    dispatch(setSession({ sessionId }))
    dispatch(connect())
  }
  , [sessionId, dispatch])

  useEffect(() => {
    if (session && user) {
      setAdminMode(session.admins?.find(([_, id]) => id === user.id) !== undefined)
    }

  }, [session, user])

  function hasForfeited() {
    return sendForfeitResult.isSuccess || sendForfeitResult.isLoading
  }


  function handleForfeit() {
    const shouldForfeit = confirm("Are you sure you want to forfeit?")
    if (shouldForfeit) {
      sendForfeit({ sessionId, playerId })
    }
  }

  return (
    <div className="flex flex-col ml-2 w-full">
      <MultiEventViewer sessionId={sessionId} />
      <div className="flex flex-row space-x-2">
        <Button
        className="w-32 mt-2"
          disabled={playerId === undefined || hasForfeited()}
          onClick={handleForfeit}
        >
          {hasForfeited() ?  "Already Forfeit" : "Forfeit"}
        </Button>

        <PauseReceivingPanel />
        </div>

      {!sessionLoading && adminMode && <ItemSender sessionId={sessionId} />}

    </div>
  )
}

export default MultiView
