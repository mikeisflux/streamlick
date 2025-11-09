/**
 * AI Caption Service - Real-time Speech Recognition
 *
 * Uses Web Speech API for real-time transcription in 100+ languages.
 * Provides live captions for accessibility and engagement.
 */

export interface Caption {
  text: string;
  timestamp: Date;
  isFinal: boolean;
  confidence?: number;
  language: string;
}

export interface CaptionConfig {
  language: string; // BCP 47 language tag (e.g., 'en-US', 'es-ES', 'fr-FR')
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
}

// Popular languages for quick selection
export const POPULAR_LANGUAGES = [
  { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧' },
  { code: 'es-ES', name: 'Spanish (Spain)', flag: '🇪🇸' },
  { code: 'es-MX', name: 'Spanish (Mexico)', flag: '🇲🇽' },
  { code: 'fr-FR', name: 'French', flag: '🇫🇷' },
  { code: 'de-DE', name: 'German', flag: '🇩🇪' },
  { code: 'it-IT', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', flag: '🇧🇷' },
  { code: 'pt-PT', name: 'Portuguese (Portugal)', flag: '🇵🇹' },
  { code: 'ru-RU', name: 'Russian', flag: '🇷🇺' },
  { code: 'ja-JP', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko-KR', name: 'Korean', flag: '🇰🇷' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', flag: '🇨🇳' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', flag: '🇹🇼' },
  { code: 'ar-SA', name: 'Arabic', flag: '🇸🇦' },
  { code: 'hi-IN', name: 'Hindi', flag: '🇮🇳' },
  { code: 'nl-NL', name: 'Dutch', flag: '🇳🇱' },
  { code: 'sv-SE', name: 'Swedish', flag: '🇸🇪' },
  { code: 'no-NO', name: 'Norwegian', flag: '🇳🇴' },
  { code: 'da-DK', name: 'Danish', flag: '🇩🇰' },
  { code: 'fi-FI', name: 'Finnish', flag: '🇫🇮' },
  { code: 'pl-PL', name: 'Polish', flag: '🇵🇱' },
  { code: 'tr-TR', name: 'Turkish', flag: '🇹🇷' },
  { code: 'el-GR', name: 'Greek', flag: '🇬🇷' },
  { code: 'he-IL', name: 'Hebrew', flag: '🇮🇱' },
  { code: 'th-TH', name: 'Thai', flag: '🇹🇭' },
  { code: 'vi-VN', name: 'Vietnamese', flag: '🇻🇳' },
  { code: 'id-ID', name: 'Indonesian', flag: '🇮🇩' },
  { code: 'cs-CZ', name: 'Czech', flag: '🇨🇿' },
  { code: 'hu-HU', name: 'Hungarian', flag: '🇭🇺' },
  { code: 'ro-RO', name: 'Romanian', flag: '🇷🇴' },
  { code: 'uk-UA', name: 'Ukrainian', flag: '🇺🇦' },
];

class CaptionService {
  private recognition: any = null; // SpeechRecognition
  private isActive: boolean = false;
  private config: CaptionConfig = {
    language: 'en-US',
    continuous: true,
    interimResults: true,
    maxAlternatives: 1,
  };
  private onCaptionCallback: ((caption: Caption) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private currentTranscript: string = '';
  private lastFinalTranscript: string = '';

  constructor() {
    // Check if Web Speech API is supported
    if (!this.isSupported()) {
      console.warn('Web Speech API not supported in this browser');
    }
  }

  /**
   * Check if speech recognition is supported
   */
  isSupported(): boolean {
    return !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );
  }

  /**
   * Start caption recognition
   */
  start(config?: Partial<CaptionConfig>): void {
    if (!this.isSupported()) {
      const error = 'Speech recognition not supported';
      console.error(error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
      return;
    }

    if (this.isActive) {
      console.warn('Caption service already running');
      return;
    }

    // Update config
    this.config = { ...this.config, ...config };

    // Initialize Speech Recognition
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.lang = this.config.language;
    this.recognition.maxAlternatives = this.config.maxAlternatives;

    // Event: Result received
    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        const confidence = event.results[i][0].confidence;

        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
          this.lastFinalTranscript = finalTranscript.trim();

          if (this.onCaptionCallback) {
            this.onCaptionCallback({
              text: transcript.trim(),
              timestamp: new Date(),
              isFinal: true,
              confidence,
              language: this.config.language,
            });
          }
        } else {
          interimTranscript += transcript;

          if (this.onCaptionCallback && this.config.interimResults) {
            this.onCaptionCallback({
              text: interimTranscript.trim(),
              timestamp: new Date(),
              isFinal: false,
              confidence,
              language: this.config.language,
            });
          }
        }
      }

      this.currentTranscript = (this.lastFinalTranscript + ' ' + interimTranscript).trim();
    };

    // Event: Error occurred
    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);

      if (event.error === 'no-speech') {
        // Restart recognition automatically for no-speech errors
        if (this.isActive && this.config.continuous) {
          setTimeout(() => {
            if (this.isActive && this.recognition) {
              this.recognition.start();
            }
          }, 1000);
        }
      } else if (event.error === 'aborted') {
        // Ignore aborted errors (happens when stopping)
        return;
      } else {
        if (this.onErrorCallback) {
          this.onErrorCallback(event.error);
        }
      }
    };

    // Event: Recognition ended
    this.recognition.onend = () => {
      // Automatically restart if continuous mode is enabled and still active
      if (this.isActive && this.config.continuous) {
        try {
          this.recognition.start();
        } catch (error) {
          console.error('Failed to restart recognition:', error);
        }
      }
    };

    // Start recognition
    try {
      this.recognition.start();
      this.isActive = true;
      console.log(`✅ AI Captions started (${this.config.language})`);
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback('Failed to start captions');
      }
    }
  }

  /**
   * Stop caption recognition
   */
  stop(): void {
    if (!this.isActive || !this.recognition) {
      return;
    }

    this.isActive = false;
    this.recognition.stop();
    this.recognition = null;
    this.currentTranscript = '';
    this.lastFinalTranscript = '';

    console.log('⏹️ AI Captions stopped');
  }

  /**
   * Change recognition language
   */
  changeLanguage(language: string): void {
    if (!this.isActive) {
      this.config.language = language;
      return;
    }

    // Restart with new language
    const wasActive = this.isActive;
    this.stop();

    if (wasActive) {
      setTimeout(() => {
        this.start({ language });
      }, 500);
    }
  }

  /**
   * Set caption callback
   */
  onCaption(callback: (caption: Caption) => void): void {
    this.onCaptionCallback = callback;
  }

  /**
   * Set error callback
   */
  onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback;
  }

  /**
   * Get current transcript
   */
  getCurrentTranscript(): string {
    return this.currentTranscript;
  }

  /**
   * Check if captions are active
   */
  active(): boolean {
    return this.isActive;
  }

  /**
   * Get current language
   */
  getLanguage(): string {
    return this.config.language;
  }

  /**
   * Get available languages list
   */
  getAvailableLanguages() {
    return POPULAR_LANGUAGES;
  }
}

export const captionService = new CaptionService();
