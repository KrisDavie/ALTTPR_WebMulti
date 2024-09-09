function MultiEventText(props: any) {
  const { event, players } = props

  const { from_player, to_player, timestamp, event_data } = event
  const event_type = event["event_type"]
  const dt = new Date(timestamp)
  const from_player_name =
    from_player >= 1 ? players[from_player - 1] : "Server"
  const to_player_name =
    to_player >= 1 ? players[to_player - 1] : "Unknown Player"

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

  var final_content: JSX.Element | null = null
  var key = event.id

  switch (event_type) {
    case "init_success":
      final_content = <>[{dt.toLocaleString()}] Successfully connected to the multiworld server as {from_player_name}</>
      break;
    case "player_join":
      final_content = <>[{dt.toLocaleString()}] {from_player_name} joined the game</>
      break;
    case "player_leave":
      final_content = <>[{dt.toLocaleString()}] {from_player_name} left the game</>
      break;
    case "player_forfeit":
      final_content = <>[{dt.toLocaleString()}] {from_player_name} forfeited!</>
      break;
    case "player_pause_receive":
      final_content = <>[{dt.toLocaleString()}] {from_player_name} paused item receiving</>
      break;
    case "player_resume_receive":
      final_content = <>[{dt.toLocaleString()}] {from_player_name} resumed item receiving</>
      break;
    case "session_create":
      final_content = <>[{dt.toLocaleString()}] Session {event_data['session_id']} created</>
      break;
    case "chat":
      key = `${event.event_historical ? "old_" : ""}${event.id}_msg`
      final_content = 
        <>
          [{dt.toLocaleString()}]{" "}
          <span className="font-bold">{from_player_name}</span>:{" "}
          {event_data["message"]}
        </>
      break;
    case "new_item":
      const { item_name, location_name } = event_data
      key = `${event.event_historical ? "old_" : ""}${event.id}_item`
      final_content = 
        <>
          [{dt.toLocaleString()}] New Item: {" "}
          <span className={`${key_items.includes(item_name) ? "font-bold" : ""}`}>{item_name}</span> from{" "}
          <span className="font-bold">{from_player_name}</span> to{" "}
          <span className="font-bold">{to_player_name}</span> ({location_name})
        </>
      break;
    default:
      // final_content = <>[{dt.toLocaleString()}] Unknown event type: {event_type}</>
      return
  }

  return (
    <div className="h-6" key={key}>
      {final_content}
    </div>
  )
}

export default MultiEventText
