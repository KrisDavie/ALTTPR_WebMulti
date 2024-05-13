export interface Event {
  id: number
  timestamp: string
  event_type: EventTypes | string
  from_player: number
  to_player: number
  event_data?: object
  session_id?: string
  event_historical?: boolean
}

export interface ItemEvent extends Event {
  event_idx: number[]
  item_name: string
  item_id: number
  location: string
}

export enum EventTypes {
  session_create = 1,
  player_join = 2,
  failed_join = 3,
  player_leave = 4,
  chat = 5,
  command = 6,
  new_item = 7,
}
