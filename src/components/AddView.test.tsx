import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import type { DictionaryResult } from '../domain/types'
import { AddView } from './AddView'

vi.mock('../lib/speech', () => ({ speakWord: vi.fn() }))
afterEach(cleanup)
const result: DictionaryResult = {
  word: 'interest', query: 'interest', fetchedAt: '2026-10-08T00:00:00.000Z',
  meanings: ['兴趣', '利息', '利益', '关注', '参与', '重要性', '股权'].map((zhGloss) => ({
    zhGloss, definition: `definition for ${zhGloss}`, partOfSpeech: 'noun', synonyms: [],
  })),
}

it('shows all returned senses and saves the whole entry with an explicit training selection', async () => {
  const user = userEvent.setup()
  const save = vi.fn().mockResolvedValue({ ok: true, message: '已保存全部词义' })
  render(<AddView onLookup={async () => result} onAdd={vi.fn()} onBulkAdd={vi.fn()} onSaveDictionary={save} />)
  await user.type(screen.getByLabelText('先查一个英文单词'), 'interest')
  await user.click(screen.getByRole('button', { name: '词典辅助' }))
  expect(screen.getByText('股权')).toBeInTheDocument()
  expect(screen.getByLabelText('训练：兴趣')).toBeChecked()
  expect(screen.getByLabelText('训练：利息')).not.toBeChecked()
  await user.click(screen.getByLabelText('训练：利息'))
  await user.clear(screen.getByLabelText('中文义项（可选）'))
  await user.type(screen.getByLabelText('中文义项（可选）'), '感兴趣')
  await user.selectOptions(screen.getByLabelText('使用场景'), 'daily')
  await user.click(screen.getByRole('button', { name: /保存全部词义/ }))
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ meanings: expect.arrayContaining([
    expect.objectContaining({ zhGloss: '感兴趣' }), expect.objectContaining({ zhGloss: '股权' }),
  ]) }), [0, 1], 'daily', undefined, false, [expect.objectContaining({ original: result.meanings[0] })])
})

it('retains edited fields and selection if the atomic save fails', async () => {
  const user = userEvent.setup()
  render(<AddView onLookup={async () => result} onAdd={vi.fn()} onBulkAdd={vi.fn()}
    onSaveDictionary={vi.fn().mockRejectedValue(new Error('保存失败'))} />)
  await user.type(screen.getByLabelText('先查一个英文单词'), 'interest')
  await user.click(screen.getByRole('button', { name: '词典辅助' }))
  await user.click(screen.getByRole('button', { name: /保存全部词义/ }))
  expect(await screen.findByText('保存失败')).toBeInTheDocument()
  expect(screen.getByLabelText('中文义项（可选）')).toHaveValue('兴趣')
  expect(screen.getByLabelText('训练：兴趣')).toBeChecked()
})

it('archives English-only meanings without requiring a training answer', async () => {
  const user = userEvent.setup()
  const save = vi.fn().mockResolvedValue({ ok: true, message: '已保存全部词义' })
  const englishOnly = { ...result, meanings: [{ partOfSpeech: 'verb', definition: 'to attract attention', synonyms: [] }] }
  render(<AddView onLookup={async () => englishOnly} onAdd={vi.fn()} onBulkAdd={vi.fn()} onSaveDictionary={save} />)
  await user.type(screen.getByLabelText('先查一个英文单词'), 'interest')
  await user.click(screen.getByRole('button', { name: '词典辅助' }))
  await user.click(screen.getByRole('button', { name: /保存全部词义/ }))
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ meanings: expect.any(Array) }), [], expect.any(String), undefined)
})

it('defaults to the first bilingual sense when an English-only meaning comes first', async () => {
  const user = userEvent.setup()
  render(<AddView onLookup={async () => ({ ...result, meanings: [
    { partOfSpeech: 'verb', definition: 'to attract attention', synonyms: [] }, result.meanings[1],
  ] })} onAdd={vi.fn()} onBulkAdd={vi.fn()} onSaveDictionary={vi.fn()} />)
  await user.type(screen.getByLabelText('先查一个英文单词'), 'interest')
  await user.click(screen.getByRole('button', { name: '词典辅助' }))
  expect(screen.getByLabelText('中文义项（可选）')).toHaveValue('利息')
  expect(screen.getByLabelText('训练：利息')).toBeChecked()
})

it('retains edits to multiple meanings while switching the form', async () => {
  const user = userEvent.setup()
  const save = vi.fn().mockResolvedValue({ ok: true, message: '已保存全部词义' })
  render(<AddView onLookup={async () => result} onAdd={vi.fn()} onBulkAdd={vi.fn()} onSaveDictionary={save} />)
  await user.type(screen.getByLabelText('先查一个英文单词'), 'interest')
  await user.click(screen.getByRole('button', { name: '词典辅助' }))
  await user.type(screen.getByLabelText('常用搭配'), 'interest in art')
  await user.click(screen.getByRole('button', { name: /利息 definition for/ }))
  await user.type(screen.getByLabelText('英文例句'), 'The loan carries interest.')
  await user.click(screen.getByRole('button', { name: /兴趣 definition for/ }))
  expect(screen.getByLabelText('常用搭配')).toHaveValue('interest in art')
  await user.click(screen.getByRole('button', { name: /保存全部词义/ }))
  expect(save.mock.calls[0][0].meanings[1].example).toBe('The loan carries interest.')
})

it('saves an English-only single entry with automatic sense classification and completion', async () => {
  const user = userEvent.setup()
  const lookup = vi.fn().mockResolvedValue(result)
  const save = vi.fn().mockResolvedValue({ ok: true, message: '已保存全部词义' })
  render(<AddView onLookup={lookup} onAdd={vi.fn()} onBulkAdd={vi.fn()} onSaveDictionary={save} />)
  await user.type(screen.getByLabelText('英文表达 *'), 'interest')
  await user.click(screen.getByRole('button', { name: /加入我的记忆队列/ }))
  expect(lookup).toHaveBeenCalledWith('interest')
  expect(save).toHaveBeenCalledWith(result, [0], 'auto', undefined, true)
  expect(await screen.findByText('已保存全部词义')).toBeInTheDocument()
})

it('defaults bulk input to per-row classification, retains failed rows and exposes format instructions', async () => {
  const user = userEvent.setup()
  const failed = { expression: 'unavailable phrase', zhGloss: '', raw: 'unavailable phrase', line: 2 }
  const bulk = vi.fn().mockResolvedValue({ added: 1, skipped: 0, sensesAdded: 3,
    failed: [{ row: failed, message: '词典离线' }], warnings: [] })
  render(<AddView onLookup={vi.fn()} onAdd={vi.fn()} onBulkAdd={bulk} />)
  await user.click(screen.getByRole('button', { name: '批量粘贴' }))
  await user.type(screen.getByLabelText('批量词汇'), 'interest\nunavailable phrase')
  expect(screen.getByLabelText('批量分类方式')).toHaveValue('auto')
  await user.click(screen.getByRole('button', { name: '补全并加入队列' }))
  expect(bulk).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ expression: 'interest', zhGloss: '' })]), 'auto', expect.any(Function))
  expect(await screen.findByText(/词典离线/)).toBeInTheDocument()
  expect(screen.getByLabelText('批量词汇')).toHaveValue('unavailable phrase')
  await user.click(screen.getByText('添加格式说明与示例'))
  expect(screen.getByRole('button', { name: '复制添加说明' })).toBeInTheDocument()
  expect(screen.getByText(/CSV 字段含逗号/)).toBeInTheDocument()
})

it('offers the prepared work vocabulary without requiring a dictionary lookup or changing pasted input', async () => {
  const user = userEvent.setup()
  const workPack = vi.fn().mockResolvedValue({ ok: true, message: '已加入 42 个共享充电宝工作表达。' })
  const lookup = vi.fn()
  render(<AddView onLookup={lookup} onAdd={vi.fn()} onBulkAdd={vi.fn()} onAddWorkVocabulary={workPack} />)
  await user.click(screen.getByRole('button', { name: '加入 42 个工作表达' }))
  expect(workPack).toHaveBeenCalledOnce()
  expect(lookup).not.toHaveBeenCalled()
  expect(await screen.findByRole('status')).toHaveTextContent('已加入 42 个共享充电宝工作表达。')
})

it('retains a reordered header and the original input when format errors need correction', async () => {
  const user = userEvent.setup()
  const bulk = vi.fn().mockResolvedValue({ added: 1, skipped: 0, sensesAdded: 1, failed: [], warnings: [] })
  render(<AddView onLookup={vi.fn()} onAdd={vi.fn()} onBulkAdd={bulk} />)
  await user.click(screen.getByRole('button', { name: '批量粘贴' }))
  const source = 'category,zhGloss,expression\ndaily,钱包,wallet\nwrong,利息,interest'
  await user.type(screen.getByLabelText('批量词汇'), source)
  await user.click(screen.getByRole('button', { name: '补全并加入队列' }))
  expect(await screen.findByRole('status')).toHaveTextContent('格式待修正')
  expect(screen.getByLabelText('批量词汇')).toHaveValue(source)
  await user.clear(screen.getByLabelText('批量词汇'))
  await user.type(screen.getByLabelText('批量词汇'), source.replace('wrong', 'finance'))
  await user.click(screen.getByRole('button', { name: '补全并加入队列' }))
  expect(bulk.mock.calls[1][0]).toEqual(expect.arrayContaining([expect.objectContaining({ expression: 'interest', category: 'finance' })]))
})

it('blocks adding an unrecognized header and retains its source for correction', async () => {
  const user = userEvent.setup()
  const bulk = vi.fn()
  render(<AddView onLookup={vi.fn()} onAdd={vi.fn()} onBulkAdd={bulk} />)
  await user.click(screen.getByRole('button', { name: '批量粘贴' }))
  const source = 'expression,zhGloss,level\ninterest,兴趣,A2'
  await user.type(screen.getByLabelText('批量词汇'), source)
  expect(screen.getByRole('alert')).toHaveTextContent('无法识别表头列“level”')
  expect(screen.getByRole('button', { name: '补全并加入队列' })).toBeDisabled()
  expect(screen.getByLabelText('批量词汇')).toHaveValue(source)
  expect(bulk).not.toHaveBeenCalled()
})

it('locks editable fields while an English-only lookup is pending so new input cannot be lost', async () => {
  const user = userEvent.setup()
  let finish!: (value: typeof result) => void
  const lookup = () => new Promise<typeof result>((resolve) => { finish = resolve })
  const save = vi.fn().mockResolvedValue({ ok: true, message: '已保存全部词义' })
  render(<AddView onLookup={lookup} onAdd={vi.fn()} onBulkAdd={vi.fn()} onSaveDictionary={save} />)
  await user.type(screen.getByLabelText('英文表达 *'), 'interest')
  await user.click(screen.getByRole('button', { name: /加入我的记忆队列/ }))
  for (const label of ['英文表达 *', '中文义项（可选）', '简短英文定义', '英文例句', '使用场景']) expect(screen.getByLabelText(label)).toBeDisabled()
  finish(result)
  await screen.findByText('已保存全部词义')
  expect(screen.getByLabelText('英文表达 *')).toBeEnabled()
})
