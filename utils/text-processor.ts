/**
 * 改进的文本处理工具
 * 提供更准确的句子分割和时间戳估算
 */

// 语言特性配置
interface LanguageConfig {
  wordsPerMinute: number // 每分钟单词/字符数
  pauseDuration: number // 句子间停顿时间(秒)
}

const languageConfigs: Record<string, LanguageConfig> = {
  "cmn-CN": { wordsPerMinute: 300, pauseDuration: 0.5 }, // 中文
  "zh-TW": { wordsPerMinute: 300, pauseDuration: 0.5 }, // 台湾中文
  "zh-HK": { wordsPerMinute: 300, pauseDuration: 0.5 }, // 香港中文
  "en-US": { wordsPerMinute: 150, pauseDuration: 0.3 }, // 美式英语
  "en-GB": { wordsPerMinute: 150, pauseDuration: 0.3 }, // 英式英语
  "ja-JP": { wordsPerMinute: 350, pauseDuration: 0.4 }, // 日语
  default: { wordsPerMinute: 200, pauseDuration: 0.4 }, // 默认配置
}

/**
 * 改进的句子分割函数
 * 支持多种语言和标点符号
 */
export function splitIntoSentences(text: string): string[] {
  if (!text || typeof text !== "string") return []

  // 更全面的句子分隔符正则表达式
  // 包括中英文句号、问号、感叹号、省略号等
  const sentenceRegex = /(?<=[.!?。！？…;；:：\n])\s*/g

  // 分割文本并过滤空句子
  let sentences = text
    .split(sentenceRegex)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  // 处理特殊情况：如果分割后没有句子，将整个文本作为一个句子
  if (sentences.length === 0 && text.trim().length > 0) {
    sentences = [text.trim()]
  }

  return sentences
}

/**
 * 获取语言配置
 */
function getLanguageConfig(languageCode: string): LanguageConfig {
  return languageConfigs[languageCode] || languageConfigs.default
}

/**
 * 计算文本的预计朗读时间
 * 根据不同语言特性调整
 */
function estimateSpeechDuration(text: string, languageCode = "default"): number {
  const config = getLanguageConfig(languageCode)

  // 计算字符数（中文）或单词数（英文）
  let count: number
  if (languageCode.startsWith("zh") || languageCode.startsWith("cmn") || languageCode.startsWith("ja")) {
    // 中文和日文按字符数计算
    count = text.length
  } else {
    // 英文按单词数计算
    count = text.split(/\s+/).filter(Boolean).length || 1
  }

  // 计算基本朗读时间（分钟）
  const minutes = count / config.wordsPerMinute

  // 转换为秒并添加基本停顿时间
  return minutes * 60 + 0.1 // 添加0.1秒作为基础停顿
}

/**
 * 改进的时间戳估算函数
 * 考虑语言特性和句子长度
 */
export function estimateTimestamps(
  sentences: string[],
  totalDuration: number,
  languageCode = "default",
): Array<{ text: string; start: number; end: number }> {
  if (sentences.length === 0) return []

  const config = getLanguageConfig(languageCode)

  // 计算每个句子的预计时长
  const estimatedDurations = sentences.map((sentence) => estimateSpeechDuration(sentence, languageCode))

  // 计算总的预计时长
  const totalEstimatedDuration = estimatedDurations.reduce((sum, duration) => sum + duration + config.pauseDuration, 0)

  // 计算调整因子，使预计总时长与实际总时长匹配
  const adjustmentFactor = totalDuration / totalEstimatedDuration

  // 应用调整因子，计算每个句子的实际时长
  const adjustedDurations = estimatedDurations.map((duration) => duration * adjustmentFactor)

  // 计算每个句子的开始和结束时间
  let currentTime = 0
  const result = []

  for (let i = 0; i < sentences.length; i++) {
    const start = currentTime
    const duration = adjustedDurations[i]
    const pauseDuration = i < sentences.length - 1 ? config.pauseDuration * adjustmentFactor : 0

    currentTime += duration + pauseDuration
    const end = currentTime

    result.push({
      text: sentences[i],
      start,
      end,
    })
  }

  return result
}

/**
 * 根据当前播放时间获取当前句子索引
 */
export function getCurrentSentenceIndex(
  timestampedSentences: Array<{ text: string; start: number; end: number }>,
  currentTime: number,
): number {
  // 边界检查
  if (!timestampedSentences || timestampedSentences.length === 0) return -1
  if (currentTime <= 0) return 0

  // 二分查找优化 - 比线性搜索更高效
  let low = 0
  let high = timestampedSentences.length - 1

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const sentence = timestampedSentences[mid]

    if (currentTime >= sentence.start && currentTime < sentence.end) {
      return mid
    } else if (currentTime < sentence.start) {
      high = mid - 1
    } else {
      low = mid + 1
    }
  }

  // 如果当前时间超出所有句子，返回最后一个句子
  if (currentTime >= timestampedSentences[timestampedSentences.length - 1].end) {
    return timestampedSentences.length - 1
  }

  return -1
}

/**
 * 动态调整时间戳
 * 根据实际播放情况微调时间戳
 */
export function adjustTimestamps(
  timestampedSentences: Array<{ text: string; start: number; end: number }>,
  actualSentenceIndex: number,
  currentTime: number,
): Array<{ text: string; start: number; end: number }> {
  if (!timestampedSentences || timestampedSentences.length === 0 || actualSentenceIndex < 0) {
    return timestampedSentences
  }

  // 复制时间戳数组，避免修改原数组
  const adjusted = [...timestampedSentences]
  const currentSentence = adjusted[actualSentenceIndex]

  // 如果当前时间不在当前句子的时间范围内，调整当前句子的开始时间
  if (currentTime < currentSentence.start || currentTime >= currentSentence.end) {
    const originalDuration = currentSentence.end - currentSentence.start
    currentSentence.start = currentTime
    currentSentence.end = currentTime + originalDuration

    // 调整后续句子的时间戳
    for (let i = actualSentenceIndex + 1; i < adjusted.length; i++) {
      const previousEnd = i > 0 ? adjusted[i - 1].end : 0
      const duration = adjusted[i].end - adjusted[i].start
      adjusted[i].start = previousEnd
      adjusted[i].end = previousEnd + duration
    }
  }

  return adjusted
}
