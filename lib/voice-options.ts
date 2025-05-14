export type VoiceOption = {
  id: string
  name: string
  gender: "MALE" | "FEMALE" | "NEUTRAL"
  languageCode: string
  languageName: string
}

// 中文语音选项
export const chineseVoices: VoiceOption[] = [
  {
    id: "zh-CN-Standard-A",
    name: "普通话 (女声)",
    gender: "FEMALE",
    languageCode: "zh-CN",
    languageName: "中文 (普通话)",
  },
  {
    id: "zh-CN-Standard-B",
    name: "普通话 (男声)",
    gender: "MALE",
    languageCode: "zh-CN",
    languageName: "中文 (普通话)",
  },
  {
    id: "zh-CN-Standard-C",
    name: "普通话 (男声 2)",
    gender: "MALE",
    languageCode: "zh-CN",
    languageName: "中文 (普通话)",
  },
  {
    id: "zh-CN-Standard-D",
    name: "普通话 (女声 2)",
    gender: "FEMALE",
    languageCode: "zh-CN",
    languageName: "中文 (普通话)",
  },
  {
    id: "zh-TW-Standard-A",
    name: "台湾话 (女声)",
    gender: "FEMALE",
    languageCode: "zh-TW",
    languageName: "中文 (台湾)",
  },
  { id: "zh-HK-Standard-A", name: "粤语 (女声)", gender: "FEMALE", languageCode: "zh-HK", languageName: "中文 (香港)" },
  { id: "zh-HK-Standard-B", name: "粤语 (男声)", gender: "MALE", languageCode: "zh-HK", languageName: "中文 (香港)" },
]

// 英文语音选项
export const englishVoices: VoiceOption[] = [
  {
    id: "en-US-Standard-A",
    name: "美式英语 (女声)",
    gender: "FEMALE",
    languageCode: "en-US",
    languageName: "英语 (美国)",
  },
  {
    id: "en-US-Standard-B",
    name: "美式英语 (男声)",
    gender: "MALE",
    languageCode: "en-US",
    languageName: "英语 (美国)",
  },
  {
    id: "en-GB-Standard-A",
    name: "英式英语 (女声)",
    gender: "FEMALE",
    languageCode: "en-GB",
    languageName: "英语 (英国)",
  },
  {
    id: "en-GB-Standard-B",
    name: "英式英语 (男声)",
    gender: "MALE",
    languageCode: "en-GB",
    languageName: "英语 (英国)",
  },
]

// 日语语音选项
export const japaneseVoices: VoiceOption[] = [
  { id: "ja-JP-Standard-A", name: "日语 (女声)", gender: "FEMALE", languageCode: "ja-JP", languageName: "日语" },
  { id: "ja-JP-Standard-B", name: "日语 (女声 2)", gender: "FEMALE", languageCode: "ja-JP", languageName: "日语" },
  { id: "ja-JP-Standard-C", name: "日语 (男声)", gender: "MALE", languageCode: "ja-JP", languageName: "日语" },
  { id: "ja-JP-Standard-D", name: "日语 (男声 2)", gender: "MALE", languageCode: "ja-JP", languageName: "日语" },
]

// 所有语音选项
export const allVoices: VoiceOption[] = [...chineseVoices, ...englishVoices, ...japaneseVoices]

// 按语言分组的语音选项
export const voicesByLanguage = {
  中文: chineseVoices,
  英语: englishVoices,
  日语: japaneseVoices,
}

// 获取默认语音
export const getDefaultVoice = (): VoiceOption => chineseVoices[0]
