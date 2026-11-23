import type { BlockRuleRow } from '@/api/types'

type T = (key: string, params?: Record<string, unknown>) => string

/**
 * Tasodifiy tanlash qoidasi matni: "Qoida: Algebra, Geometriya · O'rta 10 ta (har o'quvchiga tasodifiy)".
 * Tuzuvchining eski (bitta mavzuli) qoidasi: "Qoida: Algebra mavzusidan 5 ta".
 */
export function ruleLabel(t: T, r: BlockRuleRow): string {
  if (!r.ruleId) return t('examBlocks.myBlock.rule', { topic: r.topicName ?? '—', n: r.count })
  return t('examBlocks.myBlock.randomRule', {
    topics: r.allTopics ? t('examBlocks.myBlock.allTopics') : (r.topicName ?? '—'),
    level: r.difficulty ? t(`randomPick.levels.${r.difficulty}`) : '',
    n: r.count,
  })
}
