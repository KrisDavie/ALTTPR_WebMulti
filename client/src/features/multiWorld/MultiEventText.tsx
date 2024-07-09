function MultiEventText(props: any) {
    const { event, players } = props

    const { from_player, to_player, timestamp, event_data } = event
    const event_type = event["event_type"]
    const dt = new Date(timestamp)
    const from_player_name =
      from_player >= 1 ? players[from_player - 1] : "Server"
    const to_player_name =
      to_player >= 1 ? players[to_player - 1] : "Unknown Player"

    switch (event_type) {
      case "init_success":
        return `[${dt.toLocaleTimeString()}] Successfully connected to the multiworld server as ${from_player_name}`
      case "player_join":
        return `[${dt.toLocaleTimeString()}] ${from_player_name} joined the game`
      case "player_leave":
        return `[${dt.toLocaleTimeString()}] ${from_player_name} left the game`
      case "player_forfeit":
        return `[${dt.toLocaleTimeString()}] ${from_player_name} forfeited`
      case "chat":
        var key = `${event.event_historical ? "old_" : ""}${event.id}_msg`
        return (
          <div key={key}>
            [{dt.toLocaleTimeString()}]{" "}
            <span className="font-bold">{from_player_name}</span>:{" "}
            {event_data["message"]}
          </div>
        )
      case "new_item":
        const { item_name, location_name } = event_data
        var key = `${event.event_historical ? "old_" : ""}${event.id}_item`
        return (
          <div key={key}>
            [{dt.toLocaleTimeString()}] New Item: {item_name} from{" "}
            <span className="font-bold">{from_player_name}</span> to{" "}
            <span className="font-bold">{to_player_name}</span> ({location_name}
            )
          </div>
        )
      default:
        return null
    }
}

export default MultiEventText