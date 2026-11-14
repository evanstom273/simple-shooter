import { db } from './db.ts'

// Local high scores (#17, #53): the final cumulative score of each run.
export interface ScoreRecord {
  score: number
  wave: number
  kills: number
  at: number
}

interface ScoresData {
  best: number
  runs: ScoreRecord[]
}

const ID = 'scores'

export async function loadScores(): Promise<ScoresData> {
  try {
    const rec = await db.saves.get(ID)
    const d = rec?.data as Partial<ScoresData> | undefined
    return { best: d?.best ?? 0, runs: d?.runs ?? [] }
  } catch {
    return { best: 0, runs: [] }
  }
}

/** Records a finished run; keeps the top 20. Returns the (possibly new) best. */
export async function recordRun(r: ScoreRecord): Promise<number> {
  const d = await loadScores()
  const runs = [...d.runs, r].sort((a, b) => b.score - a.score).slice(0, 20)
  const best = Math.max(d.best, r.score)
  try {
    await db.saves.put({ id: ID, data: { best, runs }, updatedAt: Date.now() })
  } catch {
    // Private mode etc.: not saved.
  }
  return best
}
