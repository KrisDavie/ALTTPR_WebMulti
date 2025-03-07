export interface Event {
  id: number
  timestamp: number
  event_type: EventTypes | string
  from_player: number
  to_player: number
  frame_time?: number
  event_data?: {[key: string]: string}
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
  player_forfeit = 8,
  player_pause_receive = 9,
  player_resume_receive = 10,
  user_join_chat = 11,
}

export interface APIKey {
  id: number
  user_id: number
  key: string
  created_at: string
  last_used: string
}
