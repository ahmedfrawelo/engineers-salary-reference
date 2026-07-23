import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

type LooseValue = ReturnType<typeof JSON.parse>;
/**
 * Voice Command
 */
export interface VoiceCommand {
  phrases: string[]; // List of phrases that trigger this command
  action: (transcript: string) => void;
  description: string;
  category?: string;
}

/**
 * Speech Recognition Event
 */
export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

/**
 * Voice Commands Service
 *
 * Provides voice control for the application
 *
 * Features:
 * - Speech recognition (Web Speech API)
 * - Custom voice commands
 * - Arabic language support
 * - Continuous listening mode
 * - Command suggestions
 *
 * @example
 * ```typescript
 * // Register command
 * this.voiceCommands.registerCommand({
 *   phrases: ['open suppliers', 'go to suppliers', 'افتح الموردين'],
 *   action: () => this.router.navigate(['/tender/suppliers']),
 *   description: 'Navigate to suppliers page'
 * });
 *
 * // Start listening
 * this.voiceCommands.startListening();
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class VoiceCommandsService {
  private recognition?: LooseValue;
  private commands = new Map<string, VoiceCommand>();

  // Signals
  readonly isListening = signal(false);
  readonly currentTranscript = signal('');
  readonly lastCommand = signal<string | null>(null);
  readonly isSupported = signal(false);

  constructor(private router: Router) {
    this.initSpeechRecognition();
    this.registerDefaultCommands();
  }

  /**
   * Initialize speech recognition
   */
  private initSpeechRecognition(): void {
    const SpeechRecognition =
      (window as LooseValue).SpeechRecognition || (window as LooseValue).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      if (environment.enableDebugLogs)
        console.warn('[VoiceCommands] Speech Recognition not supported');
      this.isSupported.set(false);
      return;
    }

    this.isSupported.set(true);
    this.recognition = new SpeechRecognition();

    // Configuration
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'ar-SA'; // Arabic (Saudi Arabia)
    this.recognition.maxAlternatives = 3;

    // Event listeners
    this.recognition.onstart = () => {
      this.isListening.set(true);
      if (environment.enableDebugLogs) console.log('[VoiceCommands] Started listening');
    };

    this.recognition.onend = () => {
      this.isListening.set(false);
      if (environment.enableDebugLogs) console.log('[VoiceCommands] Stopped listening');
    };

    this.recognition.onresult = (event: LooseValue) => {
      const results = event.results;
      const lastResult = results[results.length - 1];

      if (lastResult.isFinal) {
        const transcript = lastResult[0].transcript.trim().toLowerCase();
        const confidence = lastResult[0].confidence;

        if (environment.enableDebugLogs)
          console.log(
            `[VoiceCommands] Recognized: "${transcript}" (${(confidence * 100).toFixed(1)}%)`
          );

        this.currentTranscript.set(transcript);
        this.processCommand(transcript);
      }
    };

    this.recognition.onerror = (event: LooseValue) => {
      console.error('[VoiceCommands] Error:', event.error);

      if (event.error === 'no-speech') {
        if (environment.enableDebugLogs) console.log('[VoiceCommands] No speech detected');
      }
    };
  }

  /**
   * Start listening
   */
  startListening(): void {
    if (!this.recognition) {
      console.error('[VoiceCommands] Speech Recognition not initialized');
      return;
    }

    try {
      this.recognition.start();
    } catch (error) {
      console.error('[VoiceCommands] Failed to start:', error);
    }
  }

  /**
   * Stop listening
   */
  stopListening(): void {
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  /**
   * Toggle listening
   */
  toggleListening(): void {
    if (this.isListening()) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  /**
   * Register a voice command
   */
  registerCommand(command: VoiceCommand): void {
    command.phrases.forEach(phrase => {
      const normalizedPhrase = phrase.toLowerCase().trim();
      this.commands.set(normalizedPhrase, command);
    });

    if (environment.enableDebugLogs)
      console.log(`[VoiceCommands] Registered: ${command.description}`);
  }

  /**
   * Unregister command
   */
  unregisterCommand(phrases: string[]): void {
    phrases.forEach(phrase => {
      const normalizedPhrase = phrase.toLowerCase().trim();
      this.commands.delete(normalizedPhrase);
    });
  }

  /**
   * Get all commands
   */
  getAllCommands(): VoiceCommand[] {
    const uniqueCommands = new Map<string, VoiceCommand>();

    this.commands.forEach(command => {
      const key = command.phrases.join(',');
      uniqueCommands.set(key, command);
    });

    return Array.from(uniqueCommands.values());
  }

  /**
   * Get commands by category
   */
  getCommandsByCategory(category: string): VoiceCommand[] {
    return this.getAllCommands().filter(cmd => cmd.category === category);
  }

  /**
   * Process voice command
   */
  private processCommand(transcript: string): void {
    const normalizedTranscript = transcript.toLowerCase().trim();

    // Exact match
    let command = this.commands.get(normalizedTranscript);

    // Fuzzy match if no exact match
    if (!command) {
      command = this.findBestMatch(normalizedTranscript);
    }

    if (command) {
      if (environment.enableDebugLogs)
        console.log(`[VoiceCommands] Executing: ${command.description}`);
      this.lastCommand.set(command.description);
      command.action(transcript);
    } else {
      if (environment.enableDebugLogs)
        console.log(`[VoiceCommands] No command found for: "${transcript}"`);
    }
  }

  /**
   * Find best matching command using fuzzy matching
   */
  private findBestMatch(transcript: string): VoiceCommand | undefined {
    let bestMatch: VoiceCommand | undefined;
    let highestScore = 0;

    this.commands.forEach((command, phrase) => {
      const score = this.calculateSimilarity(transcript, phrase);
      if (score > highestScore && score > 0.7) {
        // 70% similarity threshold
        highestScore = score;
        bestMatch = command;
      }
    });

    return bestMatch;
  }

  /**
   * Calculate string similarity (Levenshtein distance)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Levenshtein distance algorithm
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Set recognition language
   */
  setLanguage(lang: 'ar-SA' | 'en-US'): void {
    if (this.recognition) {
      this.recognition.lang = lang;
      if (environment.enableDebugLogs) console.log(`[VoiceCommands] Language set to: ${lang}`);
    }
  }

  /**
   * Register default commands
   */
  private registerDefaultCommands(): void {
    // Navigation commands
    this.registerCommand({
      phrases: ['home', 'go home', 'الرئيسية', 'اذهب للرئيسية'],
      action: () => this.router.navigate(['/']),
      description: 'Navigate to home',
      category: 'navigation'
    });

    this.registerCommand({
      phrases: ['suppliers', 'go to suppliers', 'الموردين', 'افتح الموردين'],
      action: () => this.router.navigate(['/tender/suppliers']),
      description: 'Navigate to suppliers',
      category: 'navigation'
    });

    this.registerCommand({
      phrases: ['projects', 'go to projects', 'المشاريع', 'افتح المشاريع'],
      action: () => this.router.navigate(['/tender/projects']),
      description: 'Navigate to projects',
      category: 'navigation'
    });

    // Action commands
    this.registerCommand({
      phrases: ['refresh', 'reload', 'تحديث', 'إعادة تحميل'],
      action: () => window.location.reload(),
      description: 'Refresh page',
      category: 'actions'
    });

    this.registerCommand({
      phrases: ['back', 'go back', 'رجوع', 'ارجع'],
      action: () => window.history.back(),
      description: 'Go back',
      category: 'actions'
    });

    this.registerCommand({
      phrases: ['help', 'commands', 'مساعدة', 'الأوامر'],
      action: () => this.showCommands(),
      description: 'Show available commands',
      category: 'help'
    });

    // Stop listening command
    this.registerCommand({
      phrases: ['stop listening', 'stop', 'توقف', 'توقف عن الاستماع'],
      action: () => this.stopListening(),
      description: 'Stop voice recognition',
      category: 'control'
    });
  }

  /**
   * Show available commands
   */
  private showCommands(): void {
    const commands = this.getAllCommands();
    if (environment.enableDebugLogs) {
      console.log('[VoiceCommands] Available Commands:');
      commands.forEach(cmd => {
        console.log(`- ${cmd.description}: ${cmd.phrases.join(', ')}`);
      });
    }
  }
}
