"use client";

import { useCallback, useRef, useState } from "react";

// Minimal browser audio recorder for VOICE capture. Wraps MediaRecorder and
// yields a Blob the caller uploads via POST /api/traces/upload (type=VOICE).
// No storage or path logic lives on the client.

export interface UseAudioRecorder {
  recording: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<Blob | null>;
}

// Prefer webm/opus; fall back to whatever the browser supports and our
// server-side validator accepts (ogg).
function pickMimeType(): string {
  const candidates = ["audio/webm", "audio/ogg"];
  const MR = (globalThis as any).MediaRecorder;
  if (MR?.isTypeSupported) {
    for (const c of candidates) {
      if (MR.isTypeSupported(c)) return c;
    }
  }
  return "audio/webm";
}

export function useAudioRecorder(): UseAudioRecorder {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      recorderRef.current = recorder;
      streamRef.current = stream;
      setRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "microphone unavailable");
    }
  }, []);

  const stop = useCallback(async (): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder) return null;

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType }));
      };
      recorder.stop();
    });

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setRecording(false);
    return blob;
  }, []);

  return { recording, error, start, stop };
}
