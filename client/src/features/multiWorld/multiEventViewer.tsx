import { useAppDispatch, useAppSelector } from "@/app/hooks"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useGetSessionEventsQuery, useGetPlayersQuery } from "../api/apiSlice"
import { useReadSRAMQuery } from "../sni/sniApiSlice"
import { FormEvent, FormEventHandler, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { sendChatMessage } from "./multiworldSlice"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Settings2Icon } from "lucide-react"
import { Label } from "@/components/ui/label"

function MultiEventViewer(props: any) {
  const { sessionId } = props
  const { isLoading } = useGetSessionEventsQuery(sessionId)
  const { isLoading: playersLoading, data: players } =
    useGetPlayersQuery(sessionId)
  const multiworldEvents = useAppSelector(state => state.multiworld.events)
  const receiving = useAppSelector(state => state.multiworld.receiving)
  const currentPlayer = useAppSelector(state => state.multiworld.player_id)
  const dispatch = useAppDispatch()
  const [hasScrolled, setHasScrolled] = useState(false)
  const [chatMessage, setChatMessage] = useState("")
  const initComplete = useAppSelector(state => state.multiworld.init_complete)
  const [showSelfItems, setShowSelfItems] = useState(true)
  const [showSamePlayerItems, setShowSamePlayerItems] = useState(false)
  const [showOtherItems, setShowOtherItems] = useState(true)
  const [showChat, setShowChat] = useState(true)
  const [showSystem, setShowSystem] = useState(true)

  useReadSRAMQuery({}, { pollingInterval: 1000, skip: receiving })

  const parseEvent = (event: any) => {
    const { from_player, to_player, timestamp, event_data } = event
    const event_type = event["event_type"]
    const dt = new Date(timestamp)
    const from_player_name =
      from_player >= 1 ? players[from_player - 1] : "Server"
    const to_player_name =
      to_player >= 1 ? players[to_player - 1] : "Unknown Player"

    if (
      [
        "init_success",
        "player_join",
        "player_leave",
        "player_forfeit",
      ].includes(event_type) &&
      !showSystem
    ) {
      return
    } else if (
      currentPlayer &&
      event_type === "new_item" &&
      to_player === currentPlayer &&
      !showSelfItems
    ) {
      return
    } else if (
      currentPlayer &&
      event_type === "new_item" &&
      to_player !== currentPlayer &&
      !showOtherItems
    ) {
      return
    } else if (event_type === "chat" && !showChat) {
      return
    } else if (
      event_type === "new_item" &&
      (from_player == -1 || (from_player == to_player && !showSamePlayerItems))
    ) {
      return
    }

    switch (event_type) {
      case "init_success":
        return `[${dt.toLocaleTimeString()}] Successfully connected to the multiworld server as ${from_player_name}`
      case "player_join":
        return `[${dt.toLocaleTimeString()}] ${from_player_name} joined the game`
      case "player_leave":
        return `[${dt.toLocaleTimeString()}] ${from_player_name} left the game`
      case "player_forfeit":
        return `[${dt.toLocaleTimeString()}] ${from_player_name} forfeited`
      case "chat":
        return (
          <div key={event.id}>
            [{dt.toLocaleTimeString()}]{" "}
            <span className="font-bold">{from_player_name}</span>:{" "}
            {event_data["message"]}
          </div>
        )
      case "new_item":
        const { item_name, location_name, location } = event_data
        return (
          <div key={`${event.id}_${location}`}>
            [{dt.toLocaleTimeString()}] New Item: {item_name} from{" "}
            <span className="font-bold">{from_player_name}</span> to{" "}
            <span className="font-bold">{to_player_name}</span> ({location_name}
            )
          </div>
        )
      default:
        return null
    }
  }

  const eventContainerRef = useRef<HTMLDivElement>(null)
  const scrollPrimitiveRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (eventContainerRef.current && !hasScrolled) {
      eventContainerRef.current.scrollIntoView(false)
    }
  }, [multiworldEvents])

  const handleOnWheel = (event: any) => {
    if (!scrollPrimitiveRef.current) {
      return
    }

    if (
      scrollPrimitiveRef.current?.scrollHeight ===
      scrollPrimitiveRef.current?.scrollTop +
        scrollPrimitiveRef.current?.clientHeight
    ) {
      setHasScrolled(false)
      return
    }
    setHasScrolled(true)
  }

  const handleScrollToBottom = () => {
    if (eventContainerRef.current) {
      eventContainerRef.current.scrollIntoView(false)
      setHasScrolled(false)
    }
  }
  function handleChatSubmit(event: FormEvent<HTMLFormElement>): void {
    dispatch(sendChatMessage({ message: chatMessage }))
    setChatMessage("")
    event.preventDefault()
  }

  return (
    <div className="flex flex-col">
      <ScrollArea
        className="h-72 w-4/5 rounded-md border"
        onWheel={handleOnWheel}
        scrollPrimitiveRef={scrollPrimitiveRef}
      >
        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              className="h-8 w-8 absolute top-3 right-3 opacity-50"
            >
              <Settings2Icon />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="grid gap-4">
              <div className="space-y-2 ">
                <h4 className="font-medium leading-none">Filters</h4>
                <p className="text-sm text-muted-foreground">
                  Filter the messages shown.
                </p>
              </div>
              <div className="grid gap-2">
                <div className="grid grid-cols-5 items-center gap-1">
                  <Input
                    type="checkbox"
                    id="items_to_player"
                    className="col-span-1 h-4"
                    onChange={e => setShowSelfItems(e.target.checked)}
                    checked={showSelfItems}
                  />
                  <Label htmlFor="items_to_player" className="col-span-4">
                    Items for you
                  </Label>
                </div>
                <div className="grid grid-cols-5 items-center gap-1">
                  <Input
                    type="checkbox"
                    id="items_to_others"
                    className="col-span-1 h-4"
                    onChange={e => setShowOtherItems(e.target.checked)}
                    checked={showOtherItems}
                  />
                  <Label htmlFor="items_to_others" className="col-span-4">
                    Items for other players
                  </Label>
                </div>
                <div className="grid grid-cols-5 items-center gap-1">
                  <Input
                    type="checkbox"
                    id="chat_msg"
                    className="col-span-1 h-4"
                    onChange={e => setShowChat(e.target.checked)}
                    checked={showChat}
                  />
                  <Label htmlFor="chat_msg" className="col-span-4">
                    Chat messages
                  </Label>
                </div>
                <div className="grid grid-cols-5 items-center gap-1">
                  <Input
                    type="checkbox"
                    id="system"
                    className="col-span-1 h-4"
                    onChange={e => setShowSystem(e.target.checked)}
                    checked={showSystem}
                  />
                  <Label htmlFor="system" className="col-span-4">
                    System messages
                  </Label>
                </div>
                {/* <div className="grid grid-cols-5 items-center gap-1">
                  <Input
                    type="checkbox"
                    id="same_player"
                    className="col-span-1 h-4"
                    onChange={e => setShowSamePlayerItems(e.target.checked)}
                    checked={showSamePlayerItems}
                  />
                  <Label htmlFor="same_player" className="col-span-4">
                    Items to and from the same player
                  </Label>
                </div> */}
              </div>
            </div>
          </PopoverContent>
        </Popover>
        {isLoading || playersLoading || !multiworldEvents ? (
          <div>Loading... ({isLoading})</div>
        ) : (
          <div key="multi_events" ref={eventContainerRef}>
            {multiworldEvents.map(event => {
              return <div key={event.id}>{parseEvent(event)}</div>
            })}
          </div>
        )}
        {hasScrolled && (
          <Button
            className="flex flex-col items-center space-y-4 text-sm absolute bottom-3 right-3 z-10 h-8 opacity-60"
            onClick={handleScrollToBottom}
          >
            Scroll to bottom
          </Button>
        )}
      </ScrollArea>
      <form
        id="chatBox"
        className="h-8 w-4/5 mt-2 rounded-md flex flex-row"
        onSubmit={handleChatSubmit}
      >
        <Input
          type="text"
          className="h-8 w-11/12 rounded-md flex mr-1"
          disabled={!initComplete}
          placeholder={
            initComplete
              ? "Send a message..."
              : "Cannot send messages until connected..."
          }
          value={chatMessage}
          onChange={e => setChatMessage(e.target.value)}
        />
        <Button className="h-8 w-1/12 rounded-md flex" disabled={!initComplete}>
          Send
        </Button>
      </form>
    </div>
  )
}

export default MultiEventViewer
