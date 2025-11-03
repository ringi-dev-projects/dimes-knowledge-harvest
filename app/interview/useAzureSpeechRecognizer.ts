'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { SpeechRecognitionResult } from 'microsoft-cognitiveservices-speech-sdk';

type SpeechSDKModule = typeof import('microsoft-cognitiveservices-speech-sdk');

interface AzureSpeechRecognizerOptions {
  enabled: boolean;
  locale: string;
  onRecognizing?: (result: SpeechRecognitionResult) => void;
  onRecognized?: (result: SpeechRecognitionResult) => void;
  onError?: (error: Error) => void;
}

export function useAzureSpeechRecognizer(options: AzureSpeechRecognizerOptions) {
  const { enabled, locale, onRecognized, onRecognizing, onError } = options;

  const sdkRef = useRef<SpeechSDKModule | null>(null);
  const recognizerRef = useRef<import('microsoft-cognitiveservices-speech-sdk').SpeechRecognizer | null>(null);
  const isStartingRef = useRef(false);

  const ensureSdk = useCallback(async () => {
    if (sdkRef.current) {
      return sdkRef.current;
    }
    const mod = await import('microsoft-cognitiveservices-speech-sdk');
    sdkRef.current = mod;
    return mod;
  }, []);

  const disposeRecognizer = useCallback(() => {
    const recognizer = recognizerRef.current;
    if (recognizer) {
      recognizer.close();
      recognizerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    const recognizer = recognizerRef.current;
    if (!recognizer) {
      return;
    }
    recognizer.stopContinuousRecognitionAsync(
      () => {
        disposeRecognizer();
      },
      (error) => {
        console.warn('Azure Speech stop error:', error);
        disposeRecognizer();
      }
    );
  }, [disposeRecognizer]);

  const start = useCallback(async () => {
    if (!enabled || isStartingRef.current) {
      return false;
    }
    try {
      isStartingRef.current = true;
      const sdk = await ensureSdk();

      const tokenResponse = await fetch('/api/speech/token');
      if (!tokenResponse.ok) {
        throw new Error('Failed to fetch Azure Speech token');
      }
      const { token, region } = (await tokenResponse.json()) as { token: string; region: string };
      if (!token || !region) {
        throw new Error('Azure Speech token response invalid');
      }

      const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(token, region);
      const recognitionLocale = locale === 'ja' ? 'ja-JP' : 'en-US';
      speechConfig.speechRecognitionLanguage = recognitionLocale;
      speechConfig.enableDictation();

      const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
      recognizerRef.current = recognizer;

      recognizer.recognizing = (_sender, event) => {
        if (event.result && onRecognizing) {
          onRecognizing(event.result);
        }
      };

      recognizer.recognized = (_sender, event) => {
        if (!event.result) {
          return;
        }
        if (event.result.reason === sdk.ResultReason.RecognizedSpeech) {
          onRecognized?.(event.result);
        } else if (event.result.reason === sdk.ResultReason.NoMatch) {
          // ignore
        }
      };

      recognizer.canceled = (_sender, event) => {
        const error = new Error(event.errorDetails || 'Azure Speech recognition cancelled');
        onError?.(error);
        disposeRecognizer();
      };

      recognizer.sessionStopped = () => {
        disposeRecognizer();
      };

      await new Promise<void>((resolve, reject) => {
        recognizer.startContinuousRecognitionAsync(
          () => resolve(),
          (error) => reject(error)
        );
      });

      return true;
    } catch (error) {
      console.error('Azure Speech start error:', error);
      onError?.(error instanceof Error ? error : new Error('Azure Speech recognizer failed to start'));
      disposeRecognizer();
      return false;
    } finally {
      isStartingRef.current = false;
    }
  }, [disposeRecognizer, enabled, ensureSdk, locale, onError, onRecognized, onRecognizing]);

  useEffect(() => () => {
    stop();
  }, [stop]);

  return {
    start,
    stop,
    isEnabled: enabled,
  };
}
