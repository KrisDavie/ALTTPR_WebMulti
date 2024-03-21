import { useAppSelector } from "@/app/hooks"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useGetSessionEventsQuery, useGetPlayersQuery } from "../api/apiSlice"
import { useReadSRAMQuery } from "../sni/sniApiSlice"

function MultiEventViewer(props: any) {
  const { sessionId } = props
  const { isLoading } = useGetSessionEventsQuery(sessionId)
  const { data: players } = useGetPlayersQuery(sessionId)
  const multiworldEvents = useAppSelector(state => state.multiworld.events)
  const receiving = useAppSelector(state => state.multiworld.receiving)

  useReadSRAMQuery({}, { pollingInterval: 1000, skip: receiving })

  const parseEvent = (event: any) => {
    const { from_player, to_player, timestamp, event_data } = event
    const event_type = event["event_type"]
    const dt = new Date(timestamp)
    const from_player_name = from_player >= 1 ? players[from_player - 1] : "Server"
    const to_player_name = to_player >= 1 ? players[to_player - 1] : "Unknown Player"


    if (event_type === "init_success") {
      return (
          `[${dt.toLocaleTimeString()}] Successfully connected to the multiworld server as ${from_player_name}`
      )
    }

    if (event_type === "player_join") {
      return (
          `[${dt.toLocaleTimeString()}] ${from_player_name} joined the game`
      )
    }

    if (event_type === "player_leave") {
      return (
          `[${dt.toLocaleTimeString()}] ${from_player_name} left the game`
      )
    }

    if (event_type === "player_forfeit") {
      return (
          `[${dt.toLocaleTimeString()}] ${from_player_name} forfeited`
      )
    }

    if (event_type === "new_item") {
      const { item_name, location_name, location } = event_data
      // TODO: allow user to show own items
      if ((from_player == -1) || (from_player == to_player)) {
        return
      }

      return (
        <div key={`${event.id}_${location}`}>
        [{dt.toLocaleTimeString()}] New Item: {item_name} from <span className="font-bold">{from_player_name}</span> to <span className="font-bold">{to_player_name}</span> ({location_name})
        </div>
      )
    }
  }

  return (
    <div className="flex flex-col">
      <h1>Multiworld Events: {sessionId}</h1>
      <ScrollArea className="h-72 w-4/5 rounded-md border">
        {isLoading || !multiworldEvents ? (
          <div>Loading... ({isLoading})</div>
        ) : (
          <div key="multi_events">
            {multiworldEvents.toReversed().map(event => {
              console.log(event)
              return (<div key={event.id}>{parseEvent(event)}</div>)
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

export default MultiEventViewer
