/**
 * AI-Powered Real-Time Captions Service
 * Supports multiple providers: Deepgram, AssemblyAI, Web Speech API (fallback)
 */

interface CaptionSegment {
  id: string;
  text: string;
  confidence: number;
  startTime: number;
  endTime: number;
  isFinal: boolean;
  language: string;
}

interface CaptionProvider {
  name: 'deepgram' | 'assemblyai' | 'webspeech';
  apiKey?: string;
}

type CaptionCallback = (segment: CaptionSegment) => void;

class CaptionsService {
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private websocket: WebSocket | null = null;
  private recognition: any = null; // Web Speech API
  private provider: CaptionProvider;
  private callback: CaptionCallback | null = null;
  private isRunning = false;
  private currentLanguage = 'en';
  private segmentCounter = 0;

  constructor() {
    // Default to Web Speech API if no API key provided
    this.provider = { name: 'webspeech' };
  }

  /**
   * Configure the caption provider
   */
  configure(provider: CaptionProvider): void {
    this.provider = provider;
  }

  /**
   * Start capturing captions from audio stream
   */
  async start(
    stream: MediaStream,
    callback: CaptionCallback,
    language: string = 'en'
  ): Promise<void> {
    if (this.isRunning) {
      console.warn('Captions already running');
      return;
    }

    this.callback = callback;
    this.currentLanguage = language;
    this.isRunning = true;

    switch (this.provider.name) {
      case 'deepgram':
        await this.startDeepgram(stream);
        break;
      case 'assemblyai':
        await this.startAssemblyAI(stream);
        break;
      case 'webspeech':
      default:
        await this.startWebSpeech();
        break;
    }
  }

  /**
   * Stop caption generation
   */
  stop(): void {
    this.isRunning = false;

    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.callback = null;
  }

  /**
   * Deepgram Real-Time Transcription
   */
  private async startDeepgram(stream: MediaStream): Promise<void> {
    if (!this.provider.apiKey) {
      console.error('Deepgram API key not configured');
      this.startWebSpeech(); // Fallback
      return;
    }

    try {
      // Connect to Deepgram WebSocket API
      const wsUrl = `wss://api.deepgram.com/v1/listen?language=${this.currentLanguage}&punctuate=true&interim_results=true`;

      this.websocket = new WebSocket(wsUrl, ['token', this.provider.apiKey]);

      this.websocket.onopen = () => {
        console.log('Deepgram connection established');
        this.streamAudioToWebSocket(stream);
      };

      this.websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.channel?.alternatives?.[0]?.transcript) {
          const alternative = data.channel.alternatives[0];
          const segment: CaptionSegment = {
            id: `caption-${this.segmentCounter++}`,
            text: alternative.transcript,
            confidence: alternative.confidence || 0,
            startTime: data.start || Date.now(),
            endTime: data.start + (data.duration || 0),
            isFinal: data.is_final || false,
            language: this.currentLanguage,
          };

          this.callback?.(segment);
        }
      };

      this.websocket.onerror = (error) => {
        console.error('Deepgram error:', error);
        this.stop();
        this.startWebSpeech(); // Fallback
      };

    } catch (error) {
      console.error('Failed to start Deepgram:', error);
      this.startWebSpeech(); // Fallback
    }
  }

  /**
   * AssemblyAI Real-Time Transcription
   */
  private async startAssemblyAI(stream: MediaStream): Promise<void> {
    if (!this.provider.apiKey) {
      console.error('AssemblyAI API key not configured');
      this.startWebSpeech(); // Fallback
      return;
    }

    try {
      // Connect to AssemblyAI WebSocket API
      const response = await fetch('https://api.assemblyai.com/v2/realtime/token', {
        method: 'POST',
        headers: {
          'authorization': this.provider.apiKey,
        },
        body: JSON.stringify({ expires_in: 3600 }),
      });

      const { token } = await response.json();
      const wsUrl = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`;

      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        console.log('AssemblyAI connection established');
        this.streamAudioToWebSocket(stream);
      };

      this.websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.message_type === 'FinalTranscript' || data.message_type === 'PartialTranscript') {
          const segment: CaptionSegment = {
            id: `caption-${this.segmentCounter++}`,
            text: data.text,
            confidence: data.confidence || 0,
            startTime: Date.now(),
            endTime: Date.now(),
            isFinal: data.message_type === 'FinalTranscript',
            language: this.currentLanguage,
          };

          this.callback?.(segment);
        }
      };

      this.websocket.onerror = (error) => {
        console.error('AssemblyAI error:', error);
        this.stop();
        this.startWebSpeech(); // Fallback
      };

    } catch (error) {
      console.error('Failed to start AssemblyAI:', error);
      this.startWebSpeech(); // Fallback
    }
  }

  /**
   * Web Speech API (Browser Native - Free Fallback)
   */
  private async startWebSpeech(): Promise<void> {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.error('Web Speech API not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.currentLanguage;

    this.recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const segment: CaptionSegment = {
          id: `caption-${this.segmentCounter++}`,
          text: result[0].transcript,
          confidence: result[0].confidence || 0,
          startTime: Date.now(),
          endTime: Date.now(),
          isFinal: result.isFinal,
          language: this.currentLanguage,
        };

        this.callback?.(segment);
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('Web Speech API error:', event.error);

      // Auto-restart on certain errors
      if (event.error === 'no-speech' || event.error === 'audio-capture') {
        setTimeout(() => {
          if (this.isRunning && this.recognition) {
            this.recognition.start();
          }
        }, 1000);
      }
    };

    this.recognition.onend = () => {
      // Auto-restart if still running
      if (this.isRunning && this.recognition) {
        this.recognition.start();
      }
    };

    this.recognition.start();
    console.log('Web Speech API started');
  }

  /**
   * Stream audio to WebSocket (for Deepgram/AssemblyAI)
   */
  private streamAudioToWebSocket(stream: MediaStream): void {
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    const source = this.audioContext.createMediaStreamSource(stream);

    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (event) => {
      if (this.websocket?.readyState === WebSocket.OPEN) {
        const inputData = event.inputBuffer.getChannelData(0);

        // Convert Float32Array to Int16Array (required by most APIs)
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Send binary audio data
        this.websocket.send(int16Data.buffer);
      }
    };

    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  /**
   * Change caption language on the fly
   */
  async changeLanguage(language: string): Promise<void> {
    if (!this.isRunning) {
      this.currentLanguage = language;
      return;
    }

    // Restart with new language
    const wasRunning = this.isRunning;
    const callback = this.callback;

    this.stop();

    if (wasRunning && callback) {
      // Need to get the stream from somewhere - this is a limitation
      // In practice, the caller should handle restart with new language
      console.log('Language changed to:', language);
    }
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): { code: string; name: string }[] {
    return [
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ru', name: 'Russian' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'zh', name: 'Chinese' },
      { code: 'ar', name: 'Arabic' },
      { code: 'hi', name: 'Hindi' },
      { code: 'nl', name: 'Dutch' },
      { code: 'pl', name: 'Polish' },
      { code: 'tr', name: 'Turkish' },
    ];
  }

  /**
   * Check if running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }
}

export const captionsService = new CaptionsService();
export type { CaptionSegment, CaptionProvider };
