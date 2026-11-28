// SPDX-License-Identifier: MPL-2.0
/** Actions in progress and their results, kept for this app session only. */
import { useSyncExternalStore } from 'react';

export type ActivityPhase = 'running' | 'done' | 'failed' | 'refused';
/** What a running action is at, for its picture: joining the car, sending or receiving,
 * waiting for the driver at the car's screen, or the car working. */
export type ActivityStage = 'connect' | 'transfer' | 'confirm' | 'working';

export type Activity = {
  id: number;
  carName: string;
  title: string;
  /** What is happening now, or the result. Plain display text from fixed messages. */
  detail: string;
  phase: ActivityPhase;
  /** `connect` when unset. */
  stage?: ActivityStage;
  progress?: number;
  digits?: string;
  startedAt: number;
};

let items: Activity[] = [];
let counter = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach(l => l());

export function startActivity(carName: string, title: string, detail: string): number {
  const id = ++counter;
  items = [{ id, carName, title, detail, phase: 'running' as const, startedAt: Date.now() }, ...items].slice(0, 30);
  emit();
  return id;
}

export function updateActivity(id: number, change: Partial<Omit<Activity, 'id'>>): void {
  items = items.map(a => (a.id === id ? { ...a, ...change } : a));
  emit();
}

export function useActivities(): Activity[] {
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, () => items);
}

export const runningCount = (list: Activity[]) => list.filter(a => a.phase === 'running').length;
