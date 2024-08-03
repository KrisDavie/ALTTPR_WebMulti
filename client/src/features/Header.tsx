import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import SniSettings from "./sni/sniSettings"
import { AlertCircleIcon, BugIcon, CheckIcon, HomeIcon, XCircleIcon } from "lucide-react"
import { Link } from "react-router-dom"
import { useAppSelector } from "@/app/hooks"
import { selectAvailableDevices } from "./sni/sniSlice"
import { useGetDevicesQuery, useReadSRAMQuery } from "./sni/sniApiSlice"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useLazyGetPlayersQuery } from "./api/apiSlice"
import { useEffect } from "react"
import UserButton from "./user/UserButton"
import pako from "pako"

function Header() {
  const grpcConnected = useAppSelector(state => state.sni.grpcConnected)
  const devices: string[] = useAppSelector(selectAvailableDevices)
  const sessionId: string | undefined = useAppSelector(
    state => state.multiworld.sessionId,
  )
  const player_id: number | undefined = useAppSelector(
    state => state.multiworld.player_id,
  )
  const initComplete: boolean | undefined = useAppSelector(
    state => state.multiworld.init_complete,
  )
  const connectedDevice: string | undefined = useAppSelector(
    state => state.sni.connectedDevice,
  )
  const receiving = useAppSelector(state => state.multiworld.receiving)

  const sram_updating_on_server = useAppSelector(
    state => state.multiworld.sram_updating_on_server,
  )

  const currentLog = useAppSelector(state => state.logger.log)

  const [getPlayersQuery, players] = useLazyGetPlayersQuery()
  useEffect(() => {
    if (sessionId) {
      getPlayersQuery(sessionId)
    }
  }, [sessionId])

  useGetDevicesQuery({noConnect: false}, { pollingInterval: 1000, skip: devices.length > 0 })

  useReadSRAMQuery(
    {},
    { pollingInterval: 1000, skip: !sessionId || receiving || sram_updating_on_server },
  )


  function saveLog() {
    // Add new lines to log entries, compress the log with gzip, and save it to a file in the browser
    const log = currentLog.map(entry => entry + "\n").join("")
    // Compress
    const encoder = new TextEncoder()
    const compressed = pako.gzip(encoder.encode(log))
    // Save to file
    const blob = new Blob([compressed], { type: "application/gzip" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "multiworld.log.gz"
    a.click()
    URL.revokeObjectURL(url)    
  }

  function getMultiworldStatus() {
    if (!sessionId) {
      return "No Session"
    }
    if (!initComplete) {
      return "Connecting..."
    }
    if (!player_id || !players.data) {
      return "Connected to " + sessionId
    }

    return "Connected to " + sessionId + " as " + players.data[player_id - 1]
  }

  return (
    <div className="flex flex-col h-12">
      <div className="flex absolute top-2 left-2">
        <b>{"Multiworld Session:"}</b><span>- {getMultiworldStatus()}</span>
      </div>
      <div className="flex absolute top-2 right-2 space-x-2">
        <Link to="/" reloadDocument>
          <Button variant="outline" size="icon">
            <HomeIcon />
          </Button>
        </Link>
        <Popover>
          <PopoverTrigger> 
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger >
                  <Button variant="outline">
                    <div className="pr-2">
                    SNI Settings
                    </div>
                    {!grpcConnected ? (
                      <XCircleIcon color="red" />
                    ) : devices.length === 0 ? (
                      <AlertCircleIcon color="yellow" />
                    ) : (
                      <CheckIcon color="green" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                {!grpcConnected ? (
                      "SNI Not Detected"
                    ) : devices.length === 0 ? (
                      "No Devices Found"
                    ) : (
                      "Connected to " + connectedDevice + " via SNI"
                    )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto">
            <SniSettings />
          </PopoverContent>
        </Popover>
        <ModeToggle />
        <Button variant="outline" onClick={saveLog}>
          <BugIcon className="pr-2"/>
          Save Log
        </Button>
        <UserButton />
      </div>
    </div>
  )
}

export default Header
