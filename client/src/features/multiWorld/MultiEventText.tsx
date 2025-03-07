import { Event } from "@/app/types"
import { cn } from "@/lib/utils"
import { JSX, ReactElement } from "react"
import { useGetUserNameQuery } from "../api/apiSlice"
import { skipToken } from "@reduxjs/toolkit/query"

interface MultiEventTextProps {
  event: Event
  originalPlayerNames: string[]
  finalPlayerNames: string[]
}

function MultiEventText(props: MultiEventTextProps) {
  const { event, originalPlayerNames, finalPlayerNames} = props

  const { from_player, to_player, timestamp, event_data } = event
  const { data: userName } = useGetUserNameQuery(
    from_player === -2 && event_data && event_data["user_id"]
      ? event_data["user_id"]
      : skipToken,
  )
  const event_type = event["event_type"]
  const dto = new Date(timestamp)
  const dt = (
    <span title={dto.toLocaleString()}>{dto.toLocaleTimeString()}</span>
  )


  let from_player_name: string | ReactElement = "" 

  switch (from_player) {
    case -1:
      from_player_name = "Server"
      break
    case -2:
      from_player_name = (userName && userName["username"]) || "Unknown Player"
      break
    default:
        from_player_name = (
          <span title={`${originalPlayerNames[from_player - 1]} (Player ${from_player})`}>
            {finalPlayerNames[from_player - 1]}
          </span>
        )
      break
  }

  let to_player_name: string | ReactElement = "" 

  if (to_player >= 1) {
      to_player_name = (
        <span title={`${originalPlayerNames[to_player - 1]} (Player ${to_player})`}>
          {finalPlayerNames[to_player - 1]}
        </span>
      )
  } else {
    to_player_name = "Unknown Player"
  }


  const key_items = [
    "Bow",
    "Progressive Bow",
    "Progressive Bow (Alt)",
    "Book of Mudora",
    "Hammer",
    "Hookshot",
    "Magic Mirror",
    "Ocarina",
    "Ocarina (Activated)",
    "Pegasus Boots",
    "Power Glove",
    "Cape",
    "Mushroom",
    "Shovel",
    "Lamp",
    "Magic Powder",
    "Moon Pearl",
    "Cane of Somaria",
    "Fire Rod",
    "Flippers",
    "Ice Rod",
    "Titans Mitts",
    "Bombos",
    "Ether",
    "Quake",
    "Bottle",
    "Bottle (Red Potion)",
    "Bottle (Green Potion)",
    "Bottle (Blue Potion)",
    "Bottle (Fairy)",
    "Bottle (Bee)",
    "Bottle (Good Bee)",
    "Master Sword",
    "Tempered Sword",
    "Fighter Sword",
    "Sword and Shield",
    "Golden Sword",
    "Progressive Sword",
    "Progressive Glove",
    "Silver Arrows",
    "Blue Boomerang",
    "Red Boomerang",
    "Magic Upgrade (1/2)",
    "Magic Upgrade (1/4)",
    "Small Key (Eastern Palace)",
    "Big Key (Eastern Palace)",
    "Small Key (Desert Palace)",
    "Big Key (Desert Palace)",
    "Small Key (Tower of Hera)",
    "Big Key (Tower of Hera)",
    "Small Key (Escape)",
    "Big Key (Escape)",
    "Small Key (Agahnims Tower)",
    "Big Key (Agahnims Tower)",
    "Small Key (Palace of Darkness)",
    "Big Key (Palace of Darkness)",
    "Small Key (Thieves Town)",
    "Big Key (Thieves Town)",
    "Small Key (Skull Woods)",
    "Big Key (Skull Woods)",
    "Small Key (Swamp Palace)",
    "Big Key (Swamp Palace)",
    "Small Key (Ice Palace)",
    "Big Key (Ice Palace)",
    "Small Key (Misery Mire)",
    "Big Key (Misery Mire)",
    "Small Key (Turtle Rock)",
    "Big Key (Turtle Rock)",
    "Small Key (Ganons Tower)",
    "Big Key (Ganons Tower)",
    "Small Key (Universal)",
  ]

  let final_content: JSX.Element | null = null
  let key: number | string = event.id

  switch (event_type) {
    case "init_success":
      final_content = (
        <>
          [{dt}] Successfully connected to the multiworld
          server as {from_player_name}
        </>
      )
      break
    case "player_join":
      final_content = (
        <>
          [{dt}] {from_player_name} joined the game
        </>
      )
      break
    case "player_leave":
      final_content = (
        <>
          [{dt}] {from_player_name} left the game
        </>
      )
      break
    case "player_forfeit":
      final_content = (
        <>
          [{dt}] {from_player_name} forfeited!
        </>
      )
      break
    case "player_pause_receive":
      final_content = (
        <>
          [{dt}] {from_player_name} paused item receiving
        </>
      )
      break
    case "player_resume_receive":
      final_content = (
        <>
          [{dt}] {from_player_name} resumed item receiving
        </>
      )
      break

    case "session_create": {
      if (!event_data) {
        return null
      }
      final_content = (
        <>
          [{dt}] Session {event_data["session_id"]} created
        </>
      )
      break
    }
    case "chat": {
      if (!event_data) {
        return null
      }
      key = `${event.event_historical ? "old_" : ""}${event.id}_msg`
      const chat_info_type =
        event_data["type"] === "info" || event_data["type"] === "error"
      final_content = (
        <div
          className={cn(
            chat_info_type ? "italic" : "",
            event_data["type"] === "error"
              ? "text-red-500"
              : event_data["type"] === "info"
                ? "text-green-500"
                : "",
          )}
        >
          [{dt}]{" "}
          <span className="font-bold">{from_player_name}</span>:{" "}
          {event_data["message"]}
        </div>
      )
      break
    }
    case "new_item": {
      if (!event_data) {
        return null
      }
      const { item_name, location_name } = event_data
      key = `${event.event_historical ? "old_" : ""}${event.id}_item`
      final_content = (
        <>
          [{dt}] New Item:{" "}
          <span
            className={`${key_items.includes(item_name) ? "font-bold" : ""}`}
          >
            {item_name}
          </span>{" "}
          from <span className="font-bold">{from_player_name}</span> to{" "}
          <span className="font-bold">{to_player_name}</span> ({location_name})
        </>
      )
      break
    }
    default:
      final_content = (
        <>
          [{dt}] Unknown event type: {event_type}
        </>
      )
      return
  }

  return <div key={key}>{final_content}</div>
}

export default MultiEventText
