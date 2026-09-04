import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FileSelectionBar from '@/components/ui/FileSelectionBar.vue'

describe('FileSelectionBar', () => {
    it('非選取模式時只顯示「選取」按鈕', () => {
        const wrapper = mount(FileSelectionBar, { props: { selecting: false, count: 0, canShare: false } })
        expect(wrapper.text()).toContain('選取')
        expect(wrapper.text()).not.toContain('全選')
        expect(wrapper.text()).not.toContain('下載')
    })

    it('選取模式時顯示全選/下載/取消，數量顯示在畫面上', () => {
        const wrapper = mount(FileSelectionBar, { props: { selecting: true, count: 2, canShare: false } })
        expect(wrapper.text()).toContain('全選')
        expect(wrapper.text()).toContain('下載')
        expect(wrapper.text()).toContain('取消')
        expect(wrapper.text()).toContain('2')
    })

    it('canShare 為 false 時不顯示分享按鈕', () => {
        const wrapper = mount(FileSelectionBar, { props: { selecting: true, count: 1, canShare: false } })
        expect(wrapper.text()).not.toContain('分享')
    })

    it('canShare 為 true 時顯示分享按鈕', () => {
        const wrapper = mount(FileSelectionBar, { props: { selecting: true, count: 1, canShare: true } })
        expect(wrapper.text()).toContain('分享')
    })

    it('count 為 0 時下載/分享按鈕是 disabled', () => {
        const wrapper = mount(FileSelectionBar, { props: { selecting: true, count: 0, canShare: true } })
        const buttons = wrapper.findAll('button').filter(b => ['下載', '分享'].includes(b.text()))
        buttons.forEach(b => expect(b.attributes('disabled')).toBeDefined())
    })

    it('點擊按鈕會 emit 對應事件', async () => {
        const wrapper = mount(FileSelectionBar, { props: { selecting: true, count: 1, canShare: true } })
        await wrapper.findAll('button').find(b => b.text() === '全選').trigger('click')
        await wrapper.findAll('button').find(b => b.text() === '下載').trigger('click')
        await wrapper.findAll('button').find(b => b.text() === '分享').trigger('click')
        await wrapper.findAll('button').find(b => b.text() === '取消').trigger('click')
        expect(wrapper.emitted('select-all')).toBeTruthy()
        expect(wrapper.emitted('download')).toBeTruthy()
        expect(wrapper.emitted('share')).toBeTruthy()
        expect(wrapper.emitted('stop')).toBeTruthy()
    })
})
