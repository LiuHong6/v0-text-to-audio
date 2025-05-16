/**
 * 将文本分割成句子
 * @param text 要分割的文本
 * @returns 句子数组
 */
export function splitIntoSentences(text: string): string[] {
  // 使用正则表达式分割句子，考虑中英文标点
  const sentenceRegex = /[.!?。！？…]+[\s\n]*/g
  const sentences = text.split(sentenceRegex).filter(Boolean)

  // 处理可能的空句子和修剪空白
  return sentences.map((s) => s.trim()).filter((s) => s.length > 0)
}

/**
 * 估算每个句子的时间戳
 * @param sentences 句子数组
 * @param totalDuration 音频总时长（秒）
 * @returns 带时间戳的句子数组
 */
export function estimateTimestamps(
  sentences: string[],
  totalDuration: number,
): Array<{ text: string; start: number; end: number }> {
  const totalCharacters = sentences.reduce((sum, sentence) => sum + sentence.length, 0)
  const charPerSecond = totalCharacters / totalDuration

  let currentTime = 0
  const result = []

  for (const sentence of sentences) {
    // 估算句子持续时间（基于字符数）
    // 中文字符和英文单词的发音时间不同，这里做一个简单估算
    // 实际应用中可能需要更复杂的算法
    const duration = sentence.length / charPerSecond + 0.5 // 添加0.5秒作为句子间停顿

    const start = currentTime
    currentTime += duration
    const end = currentTime

    result.push({
      text: sentence,
      start,
      end,
    })
  }

  return result
}

/**
 * 根据当前播放时间获取当前句子索引
 * @param timestampedSentences 带时间戳的句子数组
 * @param currentTime 当前播放时间（秒）
 * @returns 当前句子的索引
 */
export function getCurrentSentenceIndex(
  timestampedSentences: Array<{ text: string; start: number; end: number }>,
  currentTime: number,
): number {
  for (let i = 0; i < timestampedSentences.length; i++) {
    if (currentTime >= timestampedSentences[i].start && currentTime < timestampedSentences[i].end) {
      return i
    }
  }

  // 如果当前时间超出所有句子，返回最后一个句子
  if (timestampedSentences.length > 0 && currentTime >= timestampedSentences[timestampedSentences.length - 1].end) {
    return timestampedSentences.length - 1
  }

  return -1 // 没有找到匹配的句子
}
