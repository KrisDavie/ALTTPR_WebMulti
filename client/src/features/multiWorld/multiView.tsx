import { Params, useLoaderData } from "react-router-dom"
import MultiEventViewer from "./multiEventViewer"
import { useAppDispatch, useAppSelector } from "@/app/hooks"
import { connect, setSession } from "./multiworldSlice"
import { useSendForfeitMutation, useStartDebugMutation } from "../api/apiSlice"
import ItemSend from "./itemSend"
import { Button } from "@/components/ui/button"
import { useEffect } from "react"
import PauseReceivingPanel from "./PauseReceivingPanel"

export function loader({ params }: { params: Params }) {
  return { sessionId: params.sessionId }
}

interface MultiViewProps {
  adminMode: boolean
}

function MultiView(props: MultiViewProps) {
  const { adminMode } = props
  const dispatch = useAppDispatch()
  const playerId = useAppSelector(state => state.multiworld.player_id)
  const { sessionId } = useLoaderData() as { sessionId: string }
  const [sendForfeit, sendForfeitResult] = useSendForfeitMutation()

  useEffect(() => {
    dispatch(setSession({ sessionId }))
    dispatch(connect())
  }
  , [sessionId, dispatch])

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
    <div className="flex flex-col ml-2">
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

      {adminMode && <ItemSend sessionId={sessionId} />}

    </div>
  )
}

export default MultiView
