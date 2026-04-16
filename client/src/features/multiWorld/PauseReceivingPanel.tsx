import { useAppDispatch, useAppSelector } from "@/app/hooks"
import { Button } from "@/components/ui/button"
import { pauseReceiving, resumeReceiving, sendReadyResponse, sendUnreadyResponse, clearReadyCheck, syncPauseState } from "./multiworldSlice"
import { useGetPlayersInfoQuery } from "../api/apiSlice"
import _SpriteLocs from "@/../static/sprite_locs.json"
import { useEffect, useState } from "react"
import { ItemEvent } from "@/app/types"
import { CheckCircle2Icon } from "lucide-react"

type TSpriteLocs = {
  [key: string]: number[]
}

const SpriteLocs: TSpriteLocs = _SpriteLocs

const SHEET_WIDTH = 20
const SHEET_HEIGHT = 9

function PauseReceivingPanel() {
  const dispatch = useAppDispatch()
  const receiving_paused = useAppSelector(
    state => state.multiworld.receiving_paused,
  )
  const player_id = useAppSelector(state => state.multiworld.player_id)
  const currentQueue = useAppSelector(state => state.sni.itemQueue)
  const readyCheckActive = useAppSelector(state => state.multiworld.readyCheckActive)
  const readyCheckTimestamp = useAppSelector(state => state.multiworld.readyCheckTimestamp)
  const readyPlayers = useAppSelector(state => state.multiworld.readyPlayers)
  const sessionId = useAppSelector(state => state.multiworld.sessionId)
  const playerInfo = useGetPlayersInfoQuery(sessionId, {
    pollingInterval: 1000,
    skip: !sessionId,
  }).data
  const [wasPaused, setWasPaused] = useState(false)
  const [pauseSynced, setPauseSynced] = useState(false)

  // Sync pause state from server on reconnect/refresh
  useEffect(() => {
    if (pauseSynced || !playerInfo || !player_id || player_id <= 0) return
    const me = playerInfo.find(p => p.playerNumber === player_id)
    if (!me) return
    if (me.receivingPaused && !receiving_paused) {
      dispatch(syncPauseState(true))
    }
    setPauseSynced(true)
  }, [playerInfo, player_id, pauseSynced, receiving_paused, dispatch])

  // Auto-clear when all connected players are ready
  useEffect(() => {
    if (!readyCheckActive || !playerInfo) return
    const connectedPlayerIds = playerInfo
      .filter(p => p.connected)
      .map(p => p.playerNumber)
    if (connectedPlayerIds.length === 0) return
    const allReady = connectedPlayerIds.every(id => readyPlayers.includes(id))
    if (allReady) {
      dispatch(clearReadyCheck())
    }
  }, [readyCheckActive, readyPlayers, playerInfo, dispatch])

  // 1-minute timeout
  useEffect(() => {
    if (!readyCheckActive || !readyCheckTimestamp) return
    const elapsed = Date.now() - readyCheckTimestamp
    const remaining = Math.max(60_000 - elapsed, 0)
    const timer = setTimeout(() => {
      dispatch(clearReadyCheck())
    }, remaining)
    return () => clearTimeout(timer)
  }, [readyCheckActive, readyCheckTimestamp, dispatch])

  useEffect(() => {
    if (receiving_paused) {
      setWasPaused(true)
    } else {
      if (currentQueue.length === 0 && wasPaused) {
        setWasPaused(false)
      }
    }
  }, [receiving_paused, currentQueue, wasPaused])

  let withheldItems

  if ((receiving_paused || wasPaused) && currentQueue.length > 1) {
    withheldItems = currentQueue.map((item: ItemEvent) => {
      let item_name = item.event_data.item_name
      if (item_name.includes("Crystal")) {
        item_name = ['5', '6'].includes(item_name[8]) ? "Red Crystal" : "Crystal"
      }
      if (SpriteLocs[item_name] === undefined) return
      const posX = (SHEET_HEIGHT - SpriteLocs[item_name][0]) * 16
      const posY = (SHEET_WIDTH - SpriteLocs[item_name][1]) * 16

      return (
        <div
          key={item.id}
          className="h-[16px] w-[16px] bg-sprite"
          style={{
            backgroundPositionX: `${posY}px`,
            backgroundPositionY: `${posX}px`,
          }}
        ></div>
      )      
    })
  }

  const isReady = player_id !== undefined && readyPlayers.includes(player_id)

  return (
    <div className="flex flex-row flex-wrap align-middle items-center">
      <Button
        disabled={player_id === undefined || player_id <= 0}
        className={`w-32 mt-2 ${receiving_paused ? 'bg-yellow-500 hover:bg-yellow-600' : ''}`}
        onClick={() =>
          receiving_paused
            ? dispatch(resumeReceiving())
            : dispatch(pauseReceiving())
        }
      >
        {receiving_paused ? "Resume Receiving" : "Pause Receiving"}
      </Button>
      {readyCheckActive && (
        <Button
          disabled={player_id === undefined || player_id <= 0}
          className={`w-24 mt-2 ml-2 ${isReady ? 'bg-green-600 hover:bg-green-700' : ''}`}
          onClick={() => isReady ? dispatch(sendUnreadyResponse()) : dispatch(sendReadyResponse())}
        >
          {isReady ? <><CheckCircle2Icon size={16} className="mr-1" /> Ready</> : "Ready"}
        </Button>
      )}
      <div className="flex flex-row flex-wrap mt-2 ml-2 w-80 h-8 overflow-y-clip">{withheldItems}</div>
    </div>
  )
}

export default PauseReceivingPanel
