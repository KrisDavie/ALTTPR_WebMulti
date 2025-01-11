import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import SniSettings from "./sni/sniSettings"
import {
  AlertCircleIcon,
  BugIcon,
  CheckIcon,
  CornerDownLeftIcon,
  HomeIcon,
  XCircleIcon,
} from "lucide-react"
import { Link } from "react-router-dom"
import { useAppDispatch, useAppSelector } from "@/app/hooks"
import { selectAvailableDevices } from "./sni/sniSlice"
import {
  ingame_modes,
  useGetDevicesQuery,
  useReadSRAMQuery,
  useSendManyItemsMutation,
} from "./sni/sniApiSlice"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useLazyGetPlayersQuery } from "./api/apiSlice"
import { useEffect, useState } from "react"
import UserButton from "./user/UserButton"
import { log } from "./loggerSlice"
import { Separator } from "@/components/ui/separator"
import { useLocation } from "react-router-dom"

function Header() {
  const dispatch = useAppDispatch()
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

  const [sendManyItems] = useSendManyItemsMutation()
  const [getPlayersQuery, players] = useLazyGetPlayersQuery()
  const location = useLocation()

  useEffect(() => {
    if (sessionId) {
      getPlayersQuery(sessionId)
    }
  }, [sessionId, getPlayersQuery])

  useGetDevicesQuery(
    { noConnect: false },
    { pollingInterval: 1000, skip: devices.length > 0 },
  )

  const sram = useReadSRAMQuery(
    {},
    {
      pollingInterval: 1000,
      skip: !sessionId || receiving || sram_updating_on_server,
    },
  ).data

  const [reportGlow, setReportGlow] = useState(false)

  useEffect(() => {
    if (reportGlow) {
      const interval = setInterval(() => {
        setReportGlow(false)
      }, 500)
      return () => clearInterval(interval)
    }
  }, [reportGlow])

  useEffect(() => {
    if (
      !sram ||
      !sram["game_mode"] ||
      receiving ||
      !sessionId ||
      !ingame_modes.includes(sram["game_mode"][0])
    ) {
      return
    }
    sendManyItems({})
  }, [receiving, sessionId, sram, sendManyItems])

  function reportBug() {
    const reportText = prompt("Please describe the bug you encountered:")
    if (!reportText) {
      return
    }
    dispatch(log("BUG REPORT: " + reportText))
    setReportGlow(true)
  }

  function getMultiworldStatus() {
    let text
    if (!sessionId) {
      text = "No Session"
    } else if (!initComplete) {
      text = "Connecting..."
    } else if (!player_id || !players.data) {
      text = "Connected to " + sessionId
    } else {
      text = "Connected to " + sessionId + " as " + players.data[player_id - 1]
    }

    if (location.pathname === "/multi/" + sessionId || !sessionId) {
      return (
        <div>
          <span>{text}</span>
        </div>
      )
    } else {
      return (
        <Link to={"/multi/" + sessionId}>
          <div className="flex flex-row items-center space-x-2">
            <span>{text}</span>
            <CornerDownLeftIcon size={14} />
          </div>
        </Link>
      )
    }
  }

  return (
    <div className="flex flex-col mt-2">
      <div className="flex flex-row justify-between items-center mx-2">
        <div className="flex col space-x-2">
          <b>Multiworld Session:</b>
          {getMultiworldStatus()}
        </div>
        <div className="flex space-x-2">
          <Link to="/" reloadDocument>
            <Button variant="outline" size="icon">
              <HomeIcon />
            </Button>
          </Link>
          <Popover>
            <PopoverTrigger>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Button variant="outline">
                      <div className="pr-2">SNI Settings</div>
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
                    {!grpcConnected
                      ? "SNI Not Detected"
                      : devices.length === 0
                        ? "No Devices Found"
                        : "Connected to " + connectedDevice + " via SNI"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto">
              <SniSettings />
            </PopoverContent>
          </Popover>
          <ModeToggle />
          <Button
            className={`transition ease-out duration-300 ${reportGlow ? "bg-green-500" : ""}`}
            variant="outline"
            onClick={reportBug}
          >
            <BugIcon className="pr-2" />
            Report Bug
          </Button>
          <UserButton />
        </div>
      </div>
      <Separator orientation="horizontal" className="flex w-full mt-2" />
    </div>
  )
}

export default Header
