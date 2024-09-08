import { useAppDispatch, useAppSelector } from "@/app/hooks"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useGetSessionEventsQuery, useGetPlayersQuery } from "../api/apiSlice"
import MultiEventText from "./MultiEventText"
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

  function getMultiworldEventsText() {

    const sorted_events = multiworldEvents.filter((x: any) => x.timestamp).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
    let mwevents = sorted_events.map(event => {
      const { from_player, to_player } = event
      const event_type = event["event_type"] as string

      // Filter events

      if (
        // System events
        ([
          "init_success",
          "player_join",
          "player_leave",
          "player_forfeit",
          "player_pause_receive",
          "player_resume_receive",
        ].includes(event_type) &&
          !showSystem) ||
        // Item filters
        (event_type === "new_item" && currentPlayer &&
          (
            // Self items
            (to_player === currentPlayer && !showSelfItems) ||
            // Others items
            (to_player !== currentPlayer && !showOtherItems) ||
            // Same player items
            (from_player == -1 ||
              (from_player == to_player && !showSamePlayerItems)))
          ) ||
        // Chat messages
        (event_type === "chat" && !showChat)
      ) {
        return
      }
      return <MultiEventText key={event.id} event={event} players={players} />
    })

    mwevents = mwevents.filter((x: any) => x !== undefined)

    // deduplicate based on key
    mwevents = mwevents.reduce((acc: any[], x: any) => {
      const key = x.key
      if (!acc.some((item: any) => item.key === key)) {
        acc.push(x)
      }
      return acc
    }, [])
    return mwevents
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
      (scrollPrimitiveRef.current.scrollHeight <=
      scrollPrimitiveRef.current.scrollTop +
        scrollPrimitiveRef.current.clientHeight + event.deltaY)
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
    <div className="flex flex-col max-w-6xl">
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
            {getMultiworldEventsText()}
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
