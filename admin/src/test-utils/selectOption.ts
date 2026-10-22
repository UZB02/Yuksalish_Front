import type { DOMWrapper, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'

type Target = VueWrapper | DOMWrapper<Element>

/**
 * BaseSelect da variantni yorlig'i (yoki qiymati) bo'yicha tanlaydi: kichik ro'yxatda
 * native `<select>`, katta ro'yxatda (qidiruvli combobox) panelni ochib variantni bosadi.
 */
export async function selectOption(target: Target, labelOrValue: string): Promise<void> {
  const nativeSelect = target.find('select')
  if (nativeSelect.exists()) {
    const el = nativeSelect.element as HTMLSelectElement
    const opt = Array.from(el.options).find(
      (o) => o.value === labelOrValue || o.textContent?.trim() === labelOrValue,
    )
    if (!opt) throw new Error(`Variant topilmadi: ${labelOrValue}`)
    await nativeSelect.setValue(opt.value)
    return
  }
  const trigger = target.find('[role="combobox"]')
  if (!trigger.exists()) throw new Error('BaseSelect topilmadi')
  await trigger.trigger('click')
  await nextTick()
  const options = Array.from(document.body.querySelectorAll<HTMLElement>('[role="option"]'))
  const opt = options.find(
    (o) => o.dataset.value === labelOrValue || o.textContent?.trim() === labelOrValue,
  )
  if (!opt) throw new Error(`Variant topilmadi: ${labelOrValue}`)
  opt.click()
  await nextTick()
}
