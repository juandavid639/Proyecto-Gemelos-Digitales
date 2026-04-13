import { apiUrl } from "./api";

let _elCurrentAudio = null;

export function elStop() {
  if (_elCurrentAudio) { _elCurrentAudio.pause(); _elCurrentAudio = null; }
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

export async function elSpeak(rawText, onStart, onEnd) {
  if (!rawText || !rawText.trim()) return;
  elStop();
  const clean = rawText
    .replace(/<[^>]*>/g, " ")
    .replace(/&lt;/g, "menor que").replace(/&gt;/g, "mayor que").replace(/&amp;/g, "y")
    .replace(/[^\u0000-\u007F\u00C0-\u024F\u0400-\u04FF\s]/g, "")
    .replace(/\[.*?\]/g, "").replace(/\s+/g, " ").trim().slice(0, 2000);

  onStart && onStart();
  try {
    const sid = localStorage.getItem("gemelo_sid");
    const hdrs = { "Content-Type": "application/json" };
    if (sid) hdrs["Authorization"] = "Bearer " + sid;
    const res = await fetch(apiUrl("/speech/tts"), {
      method: "POST", credentials: "include", headers: hdrs,
      body: JSON.stringify({ text: clean }),
    });
    if (!res.ok) throw new Error("TTS " + res.status);
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const audio = new Audio(url);
    _elCurrentAudio = audio;
    audio.onended = audio.onerror = () => { onEnd && onEnd(); URL.revokeObjectURL(url); _elCurrentAudio = null; };
    audio.play();
    return audio;
  } catch (e) {
    console.warn("ElevenLabs TTS fallback:", e.message);
    if ("speechSynthesis" in window) {
      const utt = new SpeechSynthesisUtterance(clean);
      utt.lang = "es-CO"; utt.rate = 0.92;
      const esV = window.speechSynthesis.getVoices().find(v => v.lang.startsWith("es"));
      if (esV) utt.voice = esV;
      utt.onend = utt.onerror = () => onEnd && onEnd();
      window.speechSynthesis.speak(utt);
    } else { onEnd && onEnd(); }
  }
}

export async function elListen(onResult, onError) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    const chunks = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunks, { type: "audio/webm" });
      const form = new FormData();
      form.append("audio", blob, "audio.webm");
      try {
        const sid = localStorage.getItem("gemelo_sid");
        const hdrs = sid ? { "Authorization": "Bearer " + sid } : {};
        const res = await fetch(apiUrl("/speech/stt"), { method: "POST", credentials: "include", headers: hdrs, body: form });
        if (!res.ok) throw new Error("STT " + res.status);
        const data = await res.json();
        onResult && onResult(data.text || "");
      } catch (e) { onError && onError(e); }
    };
    recorder.start();
    setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 10000);
    return recorder;
  } catch (e) { onError && onError(e); }
}
