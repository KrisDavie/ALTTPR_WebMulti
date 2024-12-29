import { useAppDispatch, useAppSelector } from "@/app/hooks"
import { Button } from "@/components/ui/button"
import { pauseReceiving, resumeReceiving } from "./multiworldSlice"
import _SpriteLocs from "@/../static/sprite_locs.json"
import { useEffect, useState } from "react"
import { Event } from "@/app/types"

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
  const currentQueue = useAppSelector(state => state.sni.itemQueue)
  const [wasPaused, setWasPaused] = useState(false)

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

  if (receiving_paused || wasPaused) {
    withheldItems = currentQueue.map((item: Event) => {
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

  return (
    <div className="flex flex-row flex-wrap align-middle items-center">
      <Button
        className="w-32 mt-2"
        onClick={() =>
          receiving_paused
            ? dispatch(resumeReceiving())
            : dispatch(pauseReceiving())
        }
      >
        {receiving_paused ? "Resume Receiving" : "Pause Receiving"}
      </Button>
      {wasPaused && (
        <div className="flex flex-row flex-wrap mt-2 ml-2 w-80 h-8 overflow-y-clip">{withheldItems}</div>
      )}
    </div>
  )
}

export default PauseReceivingPanel
