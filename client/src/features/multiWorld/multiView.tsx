import { Params, useLoaderData } from "react-router-dom"
import MultiEventViewer from "./multiEventViewer"
import { useAppDispatch, useAppSelector } from "@/app/hooks"
import { connect, setSession, pauseReceiving, resumeReceiving } from "./multiworldSlice"
import { useSendForfeitMutation } from "../api/apiSlice"
import ItemSend from "./itemSend"
import { Button } from "@/components/ui/button"
import { useEffect } from "react"

export function loader({ params }: { params: Params }) {
  return { sessionId: params.sessionId }
}
function MultiView(props: any) {
  const { adminMode } = props
  const dispatch = useAppDispatch()
  const playerId = useAppSelector(state => state.multiworld.player_id)
  const { sessionId } = useLoaderData() as { sessionId: string }
  const [sendForfeit, sendForfeitResult] = useSendForfeitMutation()
  const receiving_paused = useAppSelector(state => state.multiworld.receiving_paused)

  useEffect(() => {
    dispatch(setSession({ sessionId }))
    dispatch(connect())
  }
  , [sessionId])

  return (
    <div className="flex flex-col ml-2">
      <MultiEventViewer sessionId={sessionId} />
      <div className="flex flex-row space-x-2">
        <Button
        className="w-32 mt-2"
          disabled={playerId === undefined || sendForfeitResult.isSuccess}
          onClick={() => sendForfeit({sessionId, playerId})}
        >
          {sendForfeitResult.isSuccess ?  "Already Forfeit" : "Forfeit"}
        </Button>

        <Button
          className="w-32 mt-2"
          onClick={() => receiving_paused ? dispatch(resumeReceiving()) : dispatch(pauseReceiving())}
        >
          {receiving_paused ? "Resume Receiving" : "Pause Receiving"}
        </Button>
        </div>

      {adminMode && <ItemSend sessionId={sessionId} />}

    </div>
  )
}

export default MultiView
