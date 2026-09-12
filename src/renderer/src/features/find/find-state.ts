export interface FindState {
  query: string
  activeMatch: number
  matches: number
}

export const EMPTY_FIND_STATE: FindState = { query: "", activeMatch: 0, matches: 0 }

export function resultState(query: string, activeMatch: number, matches: number): FindState {
  return { query, activeMatch, matches }
}
