import { useAppDispatch, useAppSelector } from "@/app/hooks"
import { useGetSessionEventsQuery, useGetPlayersQuery } from "../api/apiSlice"
import MultiEventText from "./MultiEventText"
import { FormEvent, useCallback, useEffect, useRef, useState } from "react"
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
import { Event } from "@/app/types"
import { ScrollArea } from "@/components/ui/scroll-area"

interface MultiEventViewerProps {
  sessionId: string
}

function MultiEventViewer(props: MultiEventViewerProps) {
  const { sessionId } = props
  const { isLoading } = useGetSessionEventsQuery(sessionId)
  const { isLoading: playersLoading, data: players } =
    useGetPlayersQuery(sessionId)
  const multiworldEvents = useAppSelector(state => state.multiworld.events)
  const currentPlayer = useAppSelector(state => state.multiworld.player_id)
  const user = useAppSelector(state => state.user)
  const dispatch = useAppDispatch()
  const [hasScrolled, setHasScrolled] = useState(false)
  const [chatMessage, setChatMessage] = useState("")
  const [showSelfItems, setShowSelfItems] = useState(true)  
  const initComplete = useAppSelector(state => state.multiworld.init_complete)
  const [showSamePlayerItems, setShowSamePlayerItems] = useState(false)
  const [showOtherItems, setShowOtherItems] = useState(true)
  const [showChat, setShowChat] = useState(true)
  const [showSystem, setShowSystem] = useState(true)

  function getFilteredEvents() {
    const sorted_events = multiworldEvents
      .filter((x: Event) => x.timestamp)
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      )
    return sorted_events.filter(event => {
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
          "session_create",
        ].includes(event_type) &&
          !showSystem) ||
        // Item filters
        (event_type === "new_item" &&
          currentPlayer &&
          // Self items
          ((to_player === currentPlayer && !showSelfItems) ||
            // Others items
            (to_player !== currentPlayer && !showOtherItems) ||
            // Same player items
            from_player == -1 ||
            (from_player == to_player && !showSamePlayerItems))) ||
        // Chat messages
        (event_type === "chat" && !showChat)
      ) {
        return false
      }
      return true
    })
  }

  let filteredEvents = getFilteredEvents()

  filteredEvents = filteredEvents.reduce((acc: Event[], x: Event) => {
    const id = x.id
    const historical = x.event_historical
    if (
      !acc.some(
        (item: Event) => item.id === id && item.event_historical === historical,
      )
    ) {
      acc.push(x)
    }
    return acc
  }, [])

  const eventContainerRef = useRef<HTMLDivElement>(null!)

  useEffect(() => {
    if (eventContainerRef.current && !hasScrolled) {
      eventContainerRef.current.scrollTo(0, eventContainerRef.current.scrollHeight)
    }
  }, [multiworldEvents, hasScrolled])

  const handleOnScroll = () => {
    if (!eventContainerRef.current) {
      return
    }
    if (eventContainerRef.current.clientHeight + eventContainerRef.current.scrollTop >= eventContainerRef.current.scrollHeight) {
      setHasScrolled(false)
      return
    }
    setHasScrolled(true)
  }

  const handleScrollToBottom = () => {
    if (eventContainerRef.current) {
      eventContainerRef.current.scrollTo(0, eventContainerRef.current.scrollHeight)
      setHasScrolled(false)
    }
  }

  function handleChatSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (!chatMessage) {
      return
    }
    dispatch(sendChatMessage({ message: chatMessage, user_id: user.id }))
    setChatMessage("")
  }

  const allEventsFiltered = () => {
    return (
      !showSelfItems &&
      !showSamePlayerItems &&
      !showOtherItems &&
      !showChat &&
      !showSystem
    )
  }

  const canSendMessages = (initComplete && currentPlayer && currentPlayer >= 0) || user.discordUsername

  const renderEvents = useCallback((event: Event) => (
    <MultiEventText key={event.id} event={event} players={players} />
  ), [players])

  const renderedEvents = filteredEvents.map(renderEvents)

  return (
    <div className="flex flex-col max-w-6xl mt-2">
      <div className="h-72 rounded-md border relative">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              className={
                "h-8 w-8 absolute top-3 right-3 opacity-75 z-10" +
                (allEventsFiltered() ? " bg-red-500" : "")
              }
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
                    disabled={currentPlayer === 0}
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
                    disabled={currentPlayer === 0}
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
              </div>
            </div>
          </PopoverContent>
        </Popover>
        {isLoading || playersLoading || !multiworldEvents ? (
          <div>Loading... ({isLoading})</div>
        ) : (
          <ScrollArea onScroll={handleOnScroll} scrollPrimitiveRef={eventContainerRef} className="h-full w-full">
            {renderedEvents}
          </ScrollArea>
            )
        }
        {hasScrolled && (
          <Button
            className="flex flex-col items-center space-y-4 text-sm absolute bottom-3 right-3 z-10 h-8 opacity-60"
            onClick={handleScrollToBottom}
          >
            Scroll to bottom
          </Button>
        )}
      </div>
      <form
        id="chatBox"
        className="h-8 mt-2 rounded-md flex flex-row"
        onSubmit={handleChatSubmit}
      >
        <Input
          type="text"
          className="h-8 rounded-md flex mr-1"
          disabled={!canSendMessages}
          placeholder={
            canSendMessages
              ? "Send a message..."
              : "Cannot send messages until connected or logged in with discord..."
          }
          value={chatMessage}
          onChange={e => setChatMessage(e.target.value)}
        />
        <Button className="h-8 w-1/12 rounded-md flex" disabled={!canSendMessages}>
          Send
        </Button>
      </form>
    </div>
  )
}

export default MultiEventViewer
