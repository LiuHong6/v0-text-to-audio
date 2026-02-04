export type VoiceOption = {
  id: string
  name: string
  gender: "MALE" | "FEMALE" | "NEUTRAL"
  languageCode: string
  languageName: string
}

// Languages with timepoints support - one option per language
export const supportedLanguages: VoiceOption[] = [
  {
    id: "cmn-CN-Wavenet-A",
    name: "Chinese",
    gender: "FEMALE",
    languageCode: "cmn-CN",
    languageName: "Chinese",
  },
  {
    id: "en-US-Wavenet-A",
    name: "English",
    gender: "FEMALE",
    languageCode: "en-US",
    languageName: "English",
  },
  {
    id: "fr-FR-Wavenet-A",
    name: "French",
    gender: "FEMALE",
    languageCode: "fr-FR",
    languageName: "French",
  },
  {
    id: "ja-JP-Wavenet-A",
    name: "Japanese",
    gender: "FEMALE",
    languageCode: "ja-JP",
    languageName: "Japanese",
  },
  {
    id: "pt-BR-Wavenet-A",
    name: "Portuguese",
    gender: "FEMALE",
    languageCode: "pt-BR",
    languageName: "Portuguese",
  },
]

// All language options (backward compatibility)
export const allVoices: VoiceOption[] = supportedLanguages

// No longer need grouping, use language list directly
export const voicesByLanguage = {
  // Keep empty object for API compatibility, but no longer used
}

// Get default language - use WaveNet for timepoints support
export const getDefaultVoice = (): VoiceOption => supportedLanguages[1] // Default to English
