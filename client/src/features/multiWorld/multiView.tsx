import { Params, useLoaderData } from "react-router-dom"
import MultiEventViewer from "./multiEventViewer"
import { useAppDispatch, useAppSelector } from "@/app/hooks"
import { connect, setSession } from "./multiworldSlice"
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

  useEffect(() => {
    dispatch(setSession({ sessionId }))
    dispatch(connect())
  }
  , [sessionId])

  return (
    <div className="flex flex-col">
      <MultiEventViewer sessionId={sessionId} />
      <Button
      className="w-32 mt-2"
        disabled={playerId === undefined || sendForfeitResult.isSuccess}
        onClick={() => sendForfeit({sessionId, playerId})}
      >
        {sendForfeitResult.isSuccess ?  "Already Forfeit" : "Forfeit"}
      </Button>

      {adminMode && <ItemSend sessionId={sessionId} />}
    </div>
  )
}

export default MultiView
