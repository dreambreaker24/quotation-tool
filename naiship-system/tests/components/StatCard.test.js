import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import StatCard from '@/components/ui/StatCard.vue'

describe('StatCard', () => {
  it('renders label and value', () => {
    const wrapper = mount(StatCard, { props: { label: '簽約案件', value: '24', trend: '+8%' } })
    expect(wrapper.text()).toContain('簽約案件')
    expect(wrapper.text()).toContain('24')
    expect(wrapper.text()).toContain('+8%')
  })

  it('shows no trend when not provided', () => {
    const wrapper = mount(StatCard, { props: { label: '進件總數', value: '42' } })
    expect(wrapper.find('[data-test="trend"]').exists()).toBe(false)
  })
})
