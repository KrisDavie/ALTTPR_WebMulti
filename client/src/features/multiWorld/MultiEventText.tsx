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
      return (<div>[{dt.toLocaleString()}] Successfully connected to the multiworld server as {from_player_name}</div>)
    case "player_join":
      return (<div>[{dt.toLocaleString()}] {from_player_name} joined the game</div>)
    case "player_leave":
      return (<div>[{dt.toLocaleString()}] {from_player_name} left the game</div>)
    case "player_forfeit":
      return (<div>[{dt.toLocaleString()}] {from_player_name} forfeited</div>)
    case "player_pause_receive":
      return (<div>[{dt.toLocaleString()}] {from_player_name} paused item receiving</div>)
    case "player_resume_receive":
      return (<div>[{dt.toLocaleString()}] {from_player_name} resumed item receiving</div>)
    case "chat":
      var key = `${event.event_historical ? "old_" : ""}${event.id}_msg`
      return (
        <div key={key}>
          [{dt.toLocaleString()}]{" "}
          <span className="font-bold">{from_player_name}</span>:{" "}
          {event_data["message"]}
        </div>
      )
    case "new_item":
      const { item_name, location_name } = event_data
      var key = `${event.event_historical ? "old_" : ""}${event.id}_item`
      return (
        <div key={key}>
          [{dt.toLocaleString()}] New Item: {item_name} from{" "}
          <span className="font-bold">{from_player_name}</span> to{" "}
          <span className="font-bold">{to_player_name}</span> ({location_name})
        </div>
      )
    default:
      return null
  }
}

export default MultiEventText
