/**
 * AudioWorkletProcessor that converts Float32 mic samples to Int16 PCM and
 * posts them to the main thread for the transcription WebSocket to forward
 * to Deepgram.
 *
 * Runs on a dedicated audio thread → no main-thread jank during UI updates.
 *
 * Buffer size: AudioWorklet processes in 128-sample chunks by default. We
 * accumulate ~4 of those (512 samples = 32ms at 16kHz) before posting, which
 * cuts latency roughly 8× vs the old ScriptProcessorNode (4096 = 256ms) while
 * keeping postMessage overhead low.
 */
class TranscriptionPCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buffer = new Int16Array(512)
    this.bufferIndex = 0
  }

  process(inputs) {
    const channel = inputs[0]?.[0]
    if (!channel) return true

    // RMS for visualiser (sent piggybacked on each post)
    let sumSquares = 0

    for (let i = 0; i < channel.length; i++) {
      const sample = channel[i] ?? 0
      sumSquares += sample * sample

      // Clamp + convert Float32 [-1, 1] → Int16
      const clamped = Math.max(-1, Math.min(1, sample))
      this.buffer[this.bufferIndex++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff

      if (this.bufferIndex >= this.buffer.length) {
        // Transfer the underlying ArrayBuffer (zero-copy) and allocate a fresh one
        const rms = Math.sqrt(sumSquares / channel.length)
        this.port.postMessage(
          { audio: this.buffer.buffer, rms },
          [this.buffer.buffer],
        )
        this.buffer = new Int16Array(512)
        this.bufferIndex = 0
        sumSquares = 0
      }
    }

    return true
  }
}

registerProcessor('transcription-pcm-processor', TranscriptionPCMProcessor)
