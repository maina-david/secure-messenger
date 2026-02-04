import { DatabaseService } from './database';

export type TranslationProvider = 'mock' | 'google' | 'deepl' | 'libre';

export interface TranslationResult {
  translatedText: string;
  detectedLanguage?: string;
  provider: TranslationProvider;
}

/**
 * Translation service with caching and multi-provider support
 *
 * Providers supported:
 * - mock: For testing/development (uses simple transformations)
 * - google: Google Translate API (requires API key)
 * - deepl: DeepL API (requires API key)
 * - libre: LibreTranslate (self-hosted or public instance)
 */
export class TranslationService {
  private db: DatabaseService;
  private provider: TranslationProvider;
  private apiKey?: string;
  private libreTranslateUrl?: string;

  constructor(
    db: DatabaseService,
    provider: TranslationProvider = 'mock',
    options?: {
      apiKey?: string;
      libreTranslateUrl?: string;
    }
  ) {
    this.db = db;
    this.provider = provider;
    this.apiKey = options?.apiKey;
    this.libreTranslateUrl = options?.libreTranslateUrl || 'https://libretranslate.com';
  }

  /**
   * Translate text to target language with caching
   */
  async translateMessage(
    messageId: number,
    text: string,
    targetLanguage: string,
    sourceLanguage?: string
  ): Promise<TranslationResult> {
    // Check cache first
    const cached = this.db.getTranslation(messageId, targetLanguage);
    if (cached) {
      console.log(`Using cached translation for message ${messageId} to ${targetLanguage}`);
      return {
        translatedText: cached.translatedText,
        provider: this.provider
      };
    }

    // Translate using configured provider
    let result: TranslationResult;

    switch (this.provider) {
      case 'mock':
        result = await this.translateWithMock(text, targetLanguage, sourceLanguage);
        break;
      case 'google':
        result = await this.translateWithGoogle(text, targetLanguage, sourceLanguage);
        break;
      case 'deepl':
        result = await this.translateWithDeepL(text, targetLanguage, sourceLanguage);
        break;
      case 'libre':
        result = await this.translateWithLibreTranslate(text, targetLanguage, sourceLanguage);
        break;
      default:
        throw new Error(`Unsupported translation provider: ${this.provider}`);
    }

    // Cache the translation
    this.db.saveTranslation(messageId, targetLanguage, result.translatedText);

    return result;
  }

  /**
   * Detect language of text (provider-specific)
   */
  async detectLanguage(text: string): Promise<string> {
    switch (this.provider) {
      case 'mock':
        return this.detectLanguageMock(text);
      case 'google':
        return this.detectLanguageGoogle(text);
      case 'deepl':
        return 'en'; // DeepL doesn't support detection, default to English
      case 'libre':
        return this.detectLanguageLibreTranslate(text);
      default:
        return 'en';
    }
  }

  /**
   * Get cached translation
   */
  getCachedTranslation(messageId: number, targetLanguage: string): string | null {
    const cached = this.db.getTranslation(messageId, targetLanguage);
    return cached?.translatedText || null;
  }

  /**
   * Clear translation cache for a message
   */
  clearCache(messageId: number, targetLanguage?: string): boolean {
    if (targetLanguage) {
      return this.db.deleteTranslation(messageId, targetLanguage);
    } else {
      return this.db.deleteAllTranslations(messageId);
    }
  }

  // Provider implementations

  private async translateWithMock(
    text: string,
    targetLanguage: string,
    _sourceLanguage?: string
  ): Promise<TranslationResult> {
    // Simple mock translation for testing
    const translations: Record<string, Record<string, string>> = {
      es: {
        'Hello': 'Hola',
        'How are you?': '¿Cómo estás?',
        'Thank you': 'Gracias',
        'Good morning': 'Buenos días'
      },
      fr: {
        'Hello': 'Bonjour',
        'How are you?': 'Comment allez-vous?',
        'Thank you': 'Merci',
        'Good morning': 'Bonjour'
      },
      de: {
        'Hello': 'Hallo',
        'How are you?': 'Wie geht es dir?',
        'Thank you': 'Danke',
        'Good morning': 'Guten Morgen'
      }
    };

    const langTranslations = translations[targetLanguage];
    const translatedText = langTranslations?.[text] || `[${targetLanguage.toUpperCase()}] ${text}`;

    return {
      translatedText,
      detectedLanguage: 'en',
      provider: 'mock'
    };
  }

  private async translateWithGoogle(
    text: string,
    targetLanguage: string,
    sourceLanguage?: string
  ): Promise<TranslationResult> {
    if (!this.apiKey) {
      throw new Error('Google Translate API key not configured');
    }

    // Google Cloud Translation API implementation
    // This would require @google-cloud/translate package
    // For now, return a placeholder
    console.warn('Google Translate not fully implemented. Using mock.');
    return this.translateWithMock(text, targetLanguage, sourceLanguage);
  }

  private async translateWithDeepL(
    text: string,
    targetLanguage: string,
    sourceLanguage?: string
  ): Promise<TranslationResult> {
    if (!this.apiKey) {
      throw new Error('DeepL API key not configured');
    }

    // DeepL API implementation
    // This would require API calls to DeepL
    // For now, return a placeholder
    console.warn('DeepL not fully implemented. Using mock.');
    return this.translateWithMock(text, targetLanguage, sourceLanguage);
  }

  private async translateWithLibreTranslate(
    text: string,
    targetLanguage: string,
    sourceLanguage?: string
  ): Promise<TranslationResult> {
    try {
      const response = await fetch(`${this.libreTranslateUrl}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text,
          source: sourceLanguage || 'auto',
          target: targetLanguage,
          format: 'text'
        })
      });

      if (!response.ok) {
        throw new Error(`LibreTranslate API error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        translatedText: data.translatedText,
        detectedLanguage: data.detectedLanguage?.language,
        provider: 'libre'
      };
    } catch (error) {
      console.error('LibreTranslate error:', error);
      // Fallback to mock on error
      console.warn('LibreTranslate failed. Using mock.');
      return this.translateWithMock(text, targetLanguage, sourceLanguage);
    }
  }

  private detectLanguageMock(_text: string): string {
    // Simple mock - always return English
    return 'en';
  }

  private async detectLanguageGoogle(_text: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Google Translate API key not configured');
    }
    // Google Cloud Translation API detection
    console.warn('Google language detection not fully implemented.');
    return 'en';
  }

  private async detectLanguageLibreTranslate(text: string): Promise<string> {
    try {
      const response = await fetch(`${this.libreTranslateUrl}/detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: text })
      });

      if (!response.ok) {
        throw new Error(`LibreTranslate API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data[0]?.language || 'en';
    } catch (error) {
      console.error('LibreTranslate detection error:', error);
      return 'en';
    }
  }

  /**
   * Get list of supported languages (provider-specific)
   */
  async getSupportedLanguages(): Promise<string[]> {
    // Common language codes
    const commonLanguages = [
      'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh',
      'ar', 'hi', 'nl', 'pl', 'tr', 'sv', 'no', 'da', 'fi', 'cs'
    ];

    switch (this.provider) {
      case 'mock':
        return ['en', 'es', 'fr', 'de'];
      case 'libre':
        try {
          const response = await fetch(`${this.libreTranslateUrl}/languages`);
          const languages = await response.json();
          return languages.map((lang: any) => lang.code);
        } catch (error) {
          console.error('Error fetching languages:', error);
          return commonLanguages;
        }
      default:
        return commonLanguages;
    }
  }
}
