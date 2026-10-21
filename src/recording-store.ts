import { isRecording, RECORDING_PREFIX, recordingKey, type Recording } from './model.js';
import type { RecordingStore } from './recorder.js';

const playingKey = (puzzleHash: string) => `playing:${puzzleHash}`;

export const extensionStore: RecordingStore = {
  async findPlaying(puzzleHash) {
    const key = playingKey(puzzleHash);
    const id = (await browser.storage.local.get(key))[key];
    if (typeof id !== 'string') return null;
    const recording = (await browser.storage.local.get(recordingKey(id)))[recordingKey(id)];
    return isRecording(recording) && recording.status === 'playing' ? recording : null;
  },
  async save(recording) {
    await browser.storage.local.set({ [recordingKey(recording.id)]: recording });
    if (recording.status === 'playing') await browser.storage.local.set({ [playingKey(recording.puzzleHash)]: recording.id });
    else await browser.storage.local.remove(playingKey(recording.puzzleHash));
  },
};

export async function listRecordings(): Promise<Recording[]> {
  const all = await browser.storage.local.get(null);
  return Object.entries(all)
    .filter(([key, value]) => key.startsWith(RECORDING_PREFIX) && isRecording(value))
    .map(([, value]) => value as Recording)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteRecording(recording: Recording) {
  const key = playingKey(recording.puzzleHash);
  const playing = (await browser.storage.local.get(key))[key];
  await browser.storage.local.remove([recordingKey(recording.id), ...(playing === recording.id ? [key] : [])]);
}
