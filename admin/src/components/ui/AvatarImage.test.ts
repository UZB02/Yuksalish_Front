import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AvatarImage from './AvatarImage.vue'

describe('AvatarImage', () => {
  it("rasm yo'q: bosh harflar, <img> yo'q", () => {
    const w = mount(AvatarImage, { props: { name: 'Aliyev Vali' } })
    expect(w.find('img').exists()).toBe(false)
    expect(w.text()).toBe('AV')
  })

  it('rasm bor: lazy, qat`iy o`lcham, alt = ism, havola API bazasi bilan', () => {
    const w = mount(AvatarImage, {
      props: { name: 'Aliyev Vali', src: '/api/v1/photos/abc?exp=1&sig=x', size: 'lg' },
    })
    const img = w.get('img')
    expect(img.attributes('src')).toBe('/api/v1/photos/abc?exp=1&sig=x')
    expect(img.attributes('loading')).toBe('lazy')
    expect(img.attributes('width')).toBe('44')
    expect(img.attributes('height')).toBe('44')
    expect(img.attributes('alt')).toBe('Aliyev Vali')
    expect(w.classes()).toContain('h-11')
  })

  it("alt='' dekorativ rasm uchun saqlanadi; o'lchamlar sm/md/xl", () => {
    const w = mount(AvatarImage, { props: { name: 'A B', src: '/api/v1/photos/x', alt: '' } })
    expect(w.get('img').attributes('alt')).toBe('')
    expect(mount(AvatarImage, { props: { name: 'A', size: 'sm' } }).classes()).toContain('h-7')
    expect(mount(AvatarImage, { props: { name: 'A', size: 'md' } }).classes()).toContain('h-9')
    expect(mount(AvatarImage, { props: { name: 'A', size: 'xl' } }).classes()).toContain('h-20')
  })

  it("rasm yuklanmasa (xato / muddati o'tgan havola) bosh harflarga qaytadi", async () => {
    const w = mount(AvatarImage, { props: { name: 'Aliyev Vali', src: '/api/v1/photos/x' } })
    await w.get('img').trigger('error')
    expect(w.find('img').exists()).toBe(false)
    expect(w.text()).toBe('AV')
    // yangi havola kelsa qayta urinadi
    await w.setProps({ src: '/api/v1/photos/y' })
    expect(w.find('img').exists()).toBe(true)
  })
})
