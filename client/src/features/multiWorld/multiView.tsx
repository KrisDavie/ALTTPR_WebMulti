import { Params, useLoaderData } from "react-router-dom"
import MultiEventViewer from "./multiEventViewer"
import { useAppDispatch } from "@/app/hooks"
import { connect, setSession } from "./multiworldSlice"

export function loader({ params }: { params: Params }) {
  return { sessionId: params.sessionId }
}
function MultiView() {
  const dispatch = useAppDispatch()
  const { sessionId } = useLoaderData() as { sessionId: string }
  dispatch(setSession({ sessionId }))
  dispatch(connect())
  return (
    <>
      <MultiEventViewer sessionId={sessionId} />
    </>
  )
}

export default MultiView
