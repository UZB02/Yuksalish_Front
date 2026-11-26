import { describe, expect, it } from 'vitest'
import { optionsFitTwoColumns } from './answerLayout'
import type { ClientQuestion } from '../lib/types'

type Q = Pick<ClientQuestion, 'type' | 'options'>
const opt = (id: string, content: ClientQuestion['options'][number]['content']) => ({ id, content })
const t = (text: string) => ({ type: 'text' as const, text })
const mk = (type: Q['type'], options: Q['options']): Q => ({ type, options })

describe('optionsFitTwoColumns', () => {
  it('qisqa matnli variantlar: 2 ustun', () => {
    expect(
      optionsFitTwoColumns(mk('single', [opt('a', [t('12')]), opt('b', [t('Toshkent')])])),
    ).toBe(true)
    expect(optionsFitTwoColumns(mk('multi', [opt('a', [t('1')]), opt('b', [t('2')])]))).toBe(true)
  })
  it('chegara: 40 belgi mumkin, 41 emas', () => {
    expect(
      optionsFitTwoColumns(mk('single', [opt('a', [t('x'.repeat(40))]), opt('b', [t('y')])])),
    ).toBe(true)
    expect(
      optionsFitTwoColumns(mk('single', [opt('a', [t('x'.repeat(41))]), opt('b', [t('y')])])),
    ).toBe(false)
  })
  it('rasm yoki formula bo`lsa, bo`sh variant, bitta variant yoki matn javobi: 1 ustun', () => {
    expect(
      optionsFitTwoColumns(
        mk('single', [opt('a', [{ type: 'math', tex: 'x' }]), opt('b', [t('1')])]),
      ),
    ).toBe(false)
    expect(
      optionsFitTwoColumns(
        mk('single', [opt('a', [{ type: 'image', assetId: 'i' }]), opt('b', [t('1')])]),
      ),
    ).toBe(false)
    expect(optionsFitTwoColumns(mk('single', [opt('a', [t('  ')]), opt('b', [t('1')])]))).toBe(
      false,
    )
    expect(optionsFitTwoColumns(mk('single', [opt('a', [t('1')])]))).toBe(false)
    expect(optionsFitTwoColumns(mk('short', [opt('a', [t('1')]), opt('b', [t('2')])]))).toBe(false)
  })
})
