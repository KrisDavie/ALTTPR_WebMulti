import { useAppSelector } from "@/app/hooks"
import { useGetPlayersInfoQuery } from "../api/apiSlice"

function MultiPlayerList() {
  const sessionId: string | undefined = useAppSelector(
    state => state.multiworld.sessionId,
  )
  const playerInfo = useGetPlayersInfoQuery(sessionId, {
    pollingInterval: 1000,
  }).data

  return (
    <div className="flex flex-col space-y-2 mt-2">
      {playerInfo?.map(player => {
        const name = player.userName
          ? `${player.userName} (${player.playerName})`
          : player.playerName
        return (
          <div key={player.playerNumber}>
            {player.playerNumber}: {name} ({player.health}/{player.maxHealth} {"❤️"}) - {player.world} - CR:{" "}
            {player.collectionRate}
          </div>
        )
      })}
    </div>
  )
}

export default MultiPlayerList
