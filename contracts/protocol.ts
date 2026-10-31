/** Stable v1 transport contract. Runtime JS client can use JSDoc import types.
 * Phase-2 snapshot/chunk/agent payloads added.
 * Phase-4 AI agent talk & reply with citations added.
 * Cooperative Survival Scenario: GameState, Action and Investigation payloads.
 */
export const PROTOCOL_VERSION = 1 as const;
export interface User { id: string; username: string }
export interface Position { x: number; y: number; z: number }
export interface PlayerState {
  player_id: string;
  position: Position;
  yaw: number;
  last_seq: number;
  updated_at: string; // RFC3339 UTC
}
export interface Capabilities { movement: boolean; world: boolean; agents: boolean }
export interface PlayerInput { seq: number; x: number; y: number; z: number; yaw: number }
export interface ErrorPayload { code: string; message: string }

export interface PlayerSnapshotItem {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface WorldSnapshot {
  server_time: number;
  players: PlayerSnapshotItem[];
}

export interface Citation {
  source_title: string;
  section: string;
  excerpt: string;
  confidence: string;
}

export interface AgentTalkRequest {
  player_id?: string;
  agent_id: string;
  text: string;
}

export interface AgentReply {
  agent_id: string;
  agent_name: string;
  text: string;
  citation?: Citation;
}

export interface GameState {
  cycle: number;
  max_cycles: number;
  oxygen: number;
  energy: number;
  hull: number;
  reactor_active: boolean;
  cooling_repaired: boolean;
  greenhouse_active: boolean;
  battery_available: boolean;
  course_calculated: boolean;
  archive_restored: boolean;
  investigation_solved: boolean;
  game_over: boolean;
  victory: boolean;
  victory_type: string;
  unlocked_clues: string[];
  logs: string[];
}

export interface GameActionPayload {
  action: string;
}

export interface InvestigationSolvePayload {
  clues: string[];
}

export interface ClientPayloads {
  'player.init': { client_time?: number; username?: string };
  'player.input': PlayerInput;
  'agent.talk': AgentTalkRequest;
  'game.action': GameActionPayload;
  'investigation.solve': InvestigationSolvePayload;
  ping: Record<string, unknown>;
}
export interface ServerPayloads {
  'player.ready': { user: User; state: PlayerState; capabilities: Capabilities };
  'world.snapshot': WorldSnapshot;
  'agent.reply': AgentReply;
  'game.state': GameState;
  'investigation.result': { solved: boolean; message: string };
  pong: Record<string, unknown>;
  error: ErrorPayload;
}
export interface Envelope<T extends string, P> {
  protocol_version: typeof PROTOCOL_VERSION;
  type: T;
  request_id: string; // nonempty for requests/replies; empty for unsolicited events
  payload: P;
}
export type ClientMessage = { [K in keyof ClientPayloads]: Envelope<K, ClientPayloads[K]> }[keyof ClientPayloads];
export type ServerMessage = { [K in keyof ServerPayloads]: Envelope<K, ServerPayloads[K]> }[keyof ServerPayloads];
export interface Credentials { username: string; password: string }
export interface AuthResponse { success: true; user: User }
