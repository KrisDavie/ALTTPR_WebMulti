import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import SniSettings from "./sni/sniSettings"
import { AlertCircleIcon, CheckIcon, HomeIcon, XCircleIcon } from "lucide-react"
import { Link } from "react-router-dom"
import { useAppSelector } from "@/app/hooks"
import { selectAvailableDevices } from "./sni/sniSlice"
import { useGetDevicesQuery } from "./sni/sniApiSlice"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useGetPlayersQuery } from "./api/apiSlice"

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
  useGetDevicesQuery({noConnect: false}, { pollingInterval: 1000, skip: devices.length > 0 })
  const { isLoading: playersLoading, data: players } = useGetPlayersQuery(sessionId)

  function getMultiworldStatus() {
    if (!sessionId) {
      return "No Session"
    }
    if (!initComplete) {
      return "Connecting..."
    }
    if (!player_id) {
      return "Connected to " + sessionId
    }
    if (playersLoading) {
      return "Loading Players..."
    }
    return "Connected to " + sessionId + " as " + players[player_id - 1]
  }

  return (
    <div className="flex flex-col h-12">
      <div className="flex absolute top-2 left-2">
        <b>{"Multiworld Session:"}</b><span>- {getMultiworldStatus()}</span>
      </div>
      <div className="flex absolute top-2 right-2">
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
      </div>
    </div>
  )
}

export default Header
