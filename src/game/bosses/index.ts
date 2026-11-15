import type { Boss, BossCtx, BossId } from './types.ts'
import { Rose } from './Rose.ts'
import { Ossuary } from './Ossuary.ts'
import { Gale } from './Gale.ts'
import { Firmament } from './Firmament.ts'

export function makeBoss(id: BossId, ctx: BossCtx): Boss {
  if (id === 'rose') return new Rose(ctx)
  if (id === 'ossuary') return new Ossuary(ctx)
  if (id === 'gale') return new Gale(ctx)
  return new Firmament(ctx)
}

/** World 1's bosses (#107, #111), by section. */
export const WORLD1_BOSSES: BossId[] = ['rose', 'ossuary', 'gale', 'firmament']
