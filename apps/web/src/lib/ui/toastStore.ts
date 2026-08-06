/**
 * Component canon #9 — Toast+Undo. "Undo แทน confirm" (commitment 6): a
 * delete/move happens immediately, and this toast is the only chance to
 * reverse it, instead of a confirm dialog gating the action beforehand.
 * Reserve confirm dialogs for the two things the plan explicitly exempts:
 * payment and permanent deletion.
 *
 * Call `showToast(message)` for a plain notice, or `showToast(message, undoFn)`
 * to offer 5 seconds to reverse an action. Mount <ToastHost/> once, at the
 * root layout — every call anywhere in the app renders through that one host.
 */
import { writable } from 'svelte/store';

export type ToastState = { message: string; undo?: () => void } | null;

export const toastState = writable<ToastState>(null);

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string, undo?: () => void) {
  if (hideTimer) clearTimeout(hideTimer);
  toastState.set({ message, undo });
  hideTimer = setTimeout(() => toastState.set(null), undo ? 5000 : 2600);
}

export function dismissToast() {
  if (hideTimer) clearTimeout(hideTimer);
  toastState.set(null);
}
