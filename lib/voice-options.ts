export type VoiceOption = {
  id: string
  name: string
  gender: "MALE" | "FEMALE" | "NEUTRAL"
  languageCode: string
  languageName: string
}

// 支持timepoints的语言选项 - 每种语言一个选项
export const supportedLanguages: VoiceOption[] = [
  {
    id: "cmn-CN-Wavenet-A",
    name: "中文",
    gender: "FEMALE",
    languageCode: "cmn-CN",
    languageName: "中文",
  },
  {
    id: "en-US-Wavenet-A",
    name: "英语",
    gender: "FEMALE",
    languageCode: "en-US",
    languageName: "英语",
  },
  {
    id: "fr-FR-Wavenet-A",
    name: "法语",
    gender: "FEMALE",
    languageCode: "fr-FR",
    languageName: "法语",
  },
  {
    id: "ja-JP-Wavenet-A",
    name: "日语",
    gender: "FEMALE",
    languageCode: "ja-JP",
    languageName: "日语",
  },
  {
    id: "pt-BR-Wavenet-A",
    name: "葡萄牙语",
    gender: "FEMALE",
    languageCode: "pt-BR",
    languageName: "葡萄牙语",
  },
]

// 所有语言选项 (保持向后兼容)
export const allVoices: VoiceOption[] = supportedLanguages

// 不再需要分组，直接使用语言列表
export const voicesByLanguage = {
  // 保持空对象以维持API兼容性，但不再使用
}

// 获取默认语言 - 使用WaveNet以支持timepoints
export const getDefaultVoice = (): VoiceOption => supportedLanguages[0] // 默认使用中文
