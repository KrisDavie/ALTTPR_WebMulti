import { useAppSelector } from "@/app/hooks"
import { useGetPlayersInfoQuery } from "../api/apiSlice"
import { CheckCircle2Icon, CircleIcon, CircleDotIcon, PauseCircleIcon, XCircleIcon } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

function MultiPlayerList() {
  const sessionId: string | undefined = useAppSelector(
    state => state.multiworld.sessionId,
  )
  const playerInfo = useGetPlayersInfoQuery(sessionId, {
    pollingInterval: 1000,
    skip: !sessionId,
  }).data
  const readyCheckActive = useAppSelector(state => state.multiworld.readyCheckActive)
  const readyPlayers = useAppSelector(state => state.multiworld.readyPlayers)

  return (
    <div className="flex flex-col space-y-2 mt-2">
      {playerInfo?.map(player => {
        const name = player.userName
          ? `${player.userName} (${player.playerName})`
          : player.playerName
        const isReady = readyPlayers.includes(player.playerNumber)
        return (
          <div key={player.playerNumber} className="flex flex-col space-y-1">
            <div className="flex flex-row items-center space-x-1">
              <div className="flex flex-row items-center space-x-1 mr-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {player.connected ? (
                      <CircleDotIcon size={16} className="text-green-500" />
                    ) : (
                      <CircleIcon size={16} className="text-muted-foreground" />
                    )}
                  </TooltipTrigger>
                  <TooltipContent>{player.connected ? "Connected" : "Disconnected"}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {readyCheckActive && player.connected && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {isReady ? (
                        <CheckCircle2Icon size={16} className="text-green-500" />
                      ) : (
                        <XCircleIcon size={16} className="text-red-500" />
                      )}
                    </TooltipTrigger>
                    <TooltipContent>{isReady ? "Ready" : "Not ready"}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {player.receivingPaused && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PauseCircleIcon size={16} className="text-yellow-500" />
                    </TooltipTrigger>
                    <TooltipContent>Pause Receiving active</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              </div>
              {name} ({player.health}/{player.maxHealth} {"❤️"}) -{" "}
              {player.world} - CR: {player.collectionRate}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default MultiPlayerList
