import { useAppSelector } from "@/app/hooks"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useGetSessionEventsQuery } from "../api/apiSlice"
import { useReadSRAMQuery } from "../sni/sniApiSlice"

function MultiEventViewer(props: any) {
  const { sessionId } = props
  const { isLoading } = useGetSessionEventsQuery(sessionId)
  const multiworldEvents = useAppSelector(state => state.multiworld.events)
  const receiving = useAppSelector(state => state.multiworld.receiving)

  useReadSRAMQuery({}, { pollingInterval: 1000, skip: receiving })

  const parseEvent = (event: any) => {
    const { from_player, to_player, timestamp, event_data } = event
    const event_type = event["event_type"]
    const dt = new Date(timestamp)

    if (event_type === "player_join") {
      return (
        <div>
          [{dt.toLocaleTimeString()}] {from_player} joined the game
        </div>
      )
    }

    if (event_type === "player_leave") {
      return (
        <div>
          [{dt.toLocaleTimeString()}] {from_player} left the game
        </div>
      )
    }

    if (event_type === "new_item") {
      const { item_name, location_name } = event_data
      if (from_player == -1) {
        return
      }

      return (
        <div>
          [{dt.toLocaleTimeString()}] New Item: {item_name} from Player{" "}
          {from_player} to Player {to_player} ({location_name})
        </div>
      )
    }
  }

  return (
    <>
      <h1>Multiworld Events: {sessionId}</h1>
      <ScrollArea className="h-72 w-4/5 rounded-md border">
        {isLoading || !multiworldEvents ? (
          <div>Loading... ({isLoading})</div>
        ) : (
          <div>
            {multiworldEvents.map(event => (
              <div key={event.id}>{parseEvent(event)}</div>
            ))}
          </div>
        )}
      </ScrollArea>
    </>
  )
}

export default MultiEventViewer
