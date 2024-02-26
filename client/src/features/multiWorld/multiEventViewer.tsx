import { useAppSelector } from "@/app/hooks"
import { ScrollArea } from "@/components/ui/scroll-area"
import React, { useEffect } from "react"
import { useGetSessionEventsQuery } from "../api/apiSlice"
import { useReadMemoryQuery, useReadSRAMQuery, useSendMemoryMutation } from "../sni/sniApiSlice"
import { ReadMemoryResponse } from "@/sni/sni"

function MultiEventViewer(props: any) {
  const { sessionId } = props
  const {
    data: events,
    error,
    isLoading,
  } = useGetSessionEventsQuery(sessionId)

  const { data: memData, error: memReadError, isLoading: memReadLoading } = useReadSRAMQuery({}, { pollingInterval: 1000})
  const player_id = useAppSelector(state => state.multiworld.player_id)

  const [ sendMemory, result ] = useSendMemoryMutation()

  // useEffect(() => {
  //   // send the latest event
  //   if (events && events.length > 0 && player_id !== 0) {
  //     // Do we need to put a lock in place?
  //     sendMemory({memLoc: "0x7e0000", memVal: events[events.length - 1].event_type})
  //   }
    
  // }, [events])

  return (
    <>
      <h1>Multiworld Events: {sessionId}</h1>
      <ScrollArea>
        {isLoading || !events ? (
          <div>Loading... ({isLoading})</div>
        ) : (
          <div>
            {events.map(event => (
              <div key={event.id}>
                {event.event_type}: {JSON.stringify(event.event_data)} from{" "}
                {event.from_player} to {event.to_player} ({event.timestamp})
              </div>
            ))}
          </div>
        )}
        {/* Loop over memData reponses and display data as hex bytes */}
        {memReadLoading || !memData ? (
          <div>Loading... ({memReadLoading})</div>
        ) : (
          <div>
            {/* Decode bytes to utf8 */}
            {/* get rom name */}
            {memData.map((mem) => (
              <div key={mem.name} className="break-words w-12/12 font-mono">
                {mem.name}: <br/> {Array.from(mem.data, byte => byte.toString(16).padStart(2, "0")).join(" ")}
              </div>
            ))}
          </div>
        )}


      </ScrollArea>
    </>
  )
}

export default MultiEventViewer
