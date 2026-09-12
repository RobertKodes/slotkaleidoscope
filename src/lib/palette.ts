/** Named parlor palette — six dyes, no extras. */
export const PALETTE = {
  coal: '#140C08',
  felt: '#5A1824',
  brass: '#C9A15B',
  lampoil: '#E8B04A',
  smoke: '#CDB892',
  claret: '#8B2430',
} as const

export type PaletteName = keyof typeof PALETTE

/** RAY sits between brass and claret — not a seventh brand color. */
export const RAY_EMBER = '#9C3A2C'
/** Stake is brass dimmed into coal. */
export const STAKE_DIM = '#8A6A3A'
/** Unknown is smoke mixed into coal. */
export const UNKNOWN_ASH = '#6A5848'

export const FAMILY_TINT: Record<string, string> = {
  SYS: PALETTE.lampoil,
  JUP: PALETTE.brass,
  RAY: RAY_EMBER,
  TKN: PALETTE.smoke,
  STK: STAKE_DIM,
  '???': UNKNOWN_ASH,
}
