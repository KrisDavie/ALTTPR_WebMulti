export interface Event {
  id: number
  session_id: string
  event_type: string
  event_data: object
  from_player: number
  to_player: number
  timestamp: string
}
