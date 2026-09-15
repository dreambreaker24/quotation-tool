import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useToast } from '@/composables/useToast'

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('不傳 action 時，toast 物件沒有 action 欄位', () => {
    const { toast, toasts } = useToast()
    toast('存好了')
    expect(toasts.value.at(-1).action).toBeUndefined()
  })

  it('傳 action 時，toast 物件帶著 label/onClick', () => {
    const { toast, toasts } = useToast()
    const onClick = vi.fn()
    toast('已移動', 'success', 4000, { label: '復原', onClick })
    const last = toasts.value.at(-1)
    expect(last.action.label).toBe('復原')
    expect(last.action.onClick).toBe(onClick)
  })

  it('duration 到了會自動移除 toast', () => {
    const { toast, toasts } = useToast()
    toast('測試')
    const id = toasts.value.at(-1).id
    vi.advanceTimersByTime(2500)
    expect(toasts.value.find(t => t.id === id)).toBeUndefined()
  })
})
