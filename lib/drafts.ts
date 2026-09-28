import type { DeleteScope } from "@/lib/api-types"

/** Unsaved work for one project in one language. */
export type Slot = {
  edits: Readonly<Record<string, string>>
  keeps: ReadonlySet<string>
}

/**
 * Every project's drafts at once. Keyed by `{target}:{language}` because key
 * names repeat across projects, and a draft that follows the user to another
 * project would be saved into it.
 */
export type DraftState = {
  slots: Readonly<Record<string, Slot>>
  selected: Readonly<Record<string, ReadonlySet<string>>>
}

const EMPTY_SLOT: Slot = { edits: {}, keeps: new Set() }
const EMPTY_SELECTION: ReadonlySet<string> = new Set()

export const emptyDrafts: DraftState = { slots: {}, selected: {} }

export const slotKeyOf = (target: string, language: string) => `${target}:${language}`

export const slotOf = (state: DraftState, slotKey: string): Slot => state.slots[slotKey] ?? EMPTY_SLOT

export const selectedOf = (state: DraftState, target: string): ReadonlySet<string> =>
  state.selected[target] ?? EMPTY_SELECTION

export const pendingCount = (slot: Slot) => Object.keys(slot.edits).length + slot.keeps.size

function without(record: Readonly<Record<string, string>>, keys: Iterable<string>) {
  const next = { ...record }
  for (const key of keys) {
    delete next[key]
  }
  return next
}

function setWithout(set: ReadonlySet<string>, keys: Iterable<string>) {
  const next = new Set(set)
  for (const key of keys) {
    next.delete(key)
  }
  return next
}

function withSlot(state: DraftState, slotKey: string, slot: Slot): DraftState {
  const slots = { ...state.slots }
  if (pendingCount(slot) === 0) {
    delete slots[slotKey]
  } else {
    slots[slotKey] = slot
  }
  return { ...state, slots }
}

/** `displayed` null means always record the value - how Confirm writes an unchanged one back. */
export function setEdit(
  state: DraftState,
  slotKey: string,
  key: string,
  value: string,
  displayed: string | null
): DraftState {
  const slot = slotOf(state, slotKey)
  const edits = value === displayed ? without(slot.edits, [key]) : { ...slot.edits, [key]: value }
  return withSlot(state, slotKey, { edits, keeps: setWithout(slot.keeps, [key]) })
}

export function setKeep(state: DraftState, slotKey: string, key: string): DraftState {
  const slot = slotOf(state, slotKey)
  return withSlot(state, slotKey, { edits: without(slot.edits, [key]), keeps: new Set(slot.keeps).add(key) })
}

export const discardSlot = (state: DraftState, slotKey: string) => withSlot(state, slotKey, EMPTY_SLOT)

/** Clears what `saved` sent, and nothing typed since. */
export function commitSlot(state: DraftState, slotKey: string, saved: Slot): DraftState {
  const slot = slotOf(state, slotKey)
  const edits = Object.fromEntries(
    Object.entries(slot.edits).filter(([key, value]) => saved.edits[key] !== value)
  )
  return withSlot(state, slotKey, { edits, keeps: setWithout(slot.keeps, saved.keeps) })
}

export function setSelected(state: DraftState, target: string, keys: readonly string[], on: boolean): DraftState {
  const next = new Set(selectedOf(state, target))
  for (const key of keys) {
    if (on) {
      next.add(key)
    } else {
      next.delete(key)
    }
  }
  return { ...state, selected: { ...state.selected, [target]: next } }
}

export const clearSelected = (state: DraftState, target: string) =>
  setSelected(state, target, [...selectedOf(state, target)], false)

export function pruneDeleted(
  state: DraftState,
  target: string,
  keys: readonly string[],
  scope: DeleteScope,
  language: string
): DraftState {
  let next = setSelected(state, target, keys, false)
  const prefix = `${target}:`
  for (const slotKey of Object.keys(state.slots)) {
    const reached = scope === "all" ? slotKey.startsWith(prefix) : slotKey === slotKeyOf(target, language)
    if (reached) {
      const slot = slotOf(next, slotKey)
      next = withSlot(next, slotKey, { edits: without(slot.edits, keys), keeps: setWithout(slot.keeps, keys) })
    }
  }
  return next
}

/** Unsaved edits and keeps across every language of one project. */
export function pendingInTarget(state: DraftState, target: string): number {
  const prefix = `${target}:`
  return Object.keys(state.slots)
    .filter((slotKey) => slotKey.startsWith(prefix))
    .reduce((sum, slotKey) => sum + pendingCount(slotOf(state, slotKey)), 0)
}

/** Drops every draft and the selection of one project - after an import rewrote it. */
export function clearTarget(state: DraftState, target: string): DraftState {
  const prefix = `${target}:`
  const slots = Object.fromEntries(Object.entries(state.slots).filter(([slotKey]) => !slotKey.startsWith(prefix)))
  const selected = { ...state.selected }
  delete selected[target]
  return { slots, selected }
}
