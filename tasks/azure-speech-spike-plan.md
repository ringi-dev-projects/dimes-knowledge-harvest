# Azure Speech Streaming Spike Plan

This spike evaluates whether Azure Speech Services (neural STT) can replace or augment the current Whisper-based transcription to hit the P0 success metrics defined in `tasks/interview-improvement-plan.md`.

## Objectives
- Reduce Japanese transcription word error rate (WER) to ≤0.25 and achieve ≥20% relative improvement vs. the Whisper baseline.
- Deliver smoother transcript bubbles by batching sentence-level updates while keeping live feedback latency under 1.5 seconds.
- Ship the experiment behind a feature flag so we can A/B compare with real interview traffic before fully adopting it.

## Baseline & Benchmarking
1. **Dataset assembly**
   - Collect 10–15 anonymized interview recordings (5–7 minutes each) across Japanese and English to capture accents and terminology.
   - Generate human-verified transcripts (via Rev/Descript or internal native speakers) to serve as ground truth.
   - Store waveforms + references in a private S3/Azure Blob container with metadata JSON (language, domain, duration).
2. **Baseline metrics**
   - Run current Whisper streaming pipeline against the dataset and capture WER, sentence latency, and fragmentation rate (messages/minute).
   - Store results in `data/benchmarks/transcription-whisper.json`.

## Azure Speech Spike Tasks
1. **Environment setup**
   - Ensure `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, and `AZURE_SPEECH_ENDPOINT` are configured.
   - Install the `@azure/cognitiveservices-speech-sdk` client and verify webpack bundling for the browser.
2. **Client integration (feature-flagged)**
   - Add a `useSpeechRecognizer` hook that can instantiate either Whisper or Azure based on `process.env.NEXT_PUBLIC_TRANSCRIPTION_ENGINE`.
   - Connect WebRTC mic stream to Azure Speech SDK using `AudioInputStream.createPushStream()`; handle locale switching.
   - Emit interim hypotheses (`Recognizing`) and finalized segments (`Recognized`) with sequence IDs for message merging.
3. **Server compatibility**
   - If needed, introduce a lightweight proxy endpoint (`/api/speech/token`) to mint Azure Speech authorization tokens securely.
   - Extend `/app/interview/page.tsx` to request the token before starting recording when the Azure engine is active.
4. **Chunk merging prototype**
   - Create a transcript assembler that groups interim chunks into sentences using punctuation/end-of-utterance markers.
   - Compare message counts vs. baseline to ensure ≥40% reduction in fragments.
5. **Latency instrumentation**
   - Measure time from utterance end to final transcript commit; target ≤1.5s (log to `interview_transcript_latency` events).
6. **Fallback handling**
   - On Azure errors/timeouts, revert to Whisper seamlessly and log `transcriber_fallback` metrics.
   - Provide UI notice only if both engines fail (reuse existing error state).

## Evaluation Steps
1. Run the assembled dataset through the Azure flow (offline batch) and compute WER vs. ground truth, storing results next to the baseline file.
2. Compare latency and fragmentation metrics against success thresholds; summarize in `docs/experiments/transcription-spike.md`.
3. Conduct a limited live pilot (internal users) by enabling the feature flag for select company IDs and gathering qualitative feedback.

## Deliverables
- Code branch with feature-flagged Azure Speech integration, assembler utilities, and telemetry.
- Benchmark report detailing WER/latency before and after the change.
- Decision memo (adopt, iterate, or revert) filed in `docs/experiments/`.

## Open Questions
- Do we need pronunciation lexicons/custom phrases for domain-specific terms (e.g., manufacturing vocabulary)?
- Is diarization required from Azure, or can we continue speaker detection via existing WebRTC metadata?
- What’s the cost delta vs. Whisper usage, and do we need budgeting safeguards?
