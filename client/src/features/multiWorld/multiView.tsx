import { useLoaderData } from "react-router-dom"
import MultiEventViewer from "./multiEventViewer"
import { useAppDispatch } from "@/app/hooks"
import { connect, setSession } from "./multiworldSlice"

export async function loader({ params }: { params: { sessionId: string } }) {
  return { sessionId: params.sessionId }
}

function MultiView(props: any) {
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
