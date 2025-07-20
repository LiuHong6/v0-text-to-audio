/**
 * 将文本分割成句子
 * @param text 要分割的文本
 * @returns 句子数组
 */
export function splitIntoSentences(text: string): string[] {
  // 使用正则表达式分割句子，考虑中英文标点
  // 修改正则表达式以更准确地分割句子，与API保持一致
  const sentenceRegex = /([.!?。！？…]+[\s\n]*)/g
  const parts = text.split(sentenceRegex)

  // 合并句子和标点
  const sentences = []
  for (let i = 0; i < parts.length - 1; i += 2) {
    if (parts[i] && parts[i + 1]) {
      sentences.push(parts[i] + parts[i + 1])
    } else if (parts[i]) {
      sentences.push(parts[i])
    }
  }

  // 如果最后一部分没有标点，也添加进去
  if (parts.length % 2 === 1 && parts[parts.length - 1]) {
    sentences.push(parts[parts.length - 1])
  }

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
  if (sentences.length === 0) {
    return []
  }

  if (sentences.length === 1) {
    // 单句情况，占用整个时长
    return [{
      text: sentences[0],
      start: 0,
      end: totalDuration,
    }]
  }

  // 计算每个句子的权重（基于字符数和复杂度）
  const sentenceWeights = sentences.map(sentence => {
    // 基础权重基于字符数
    let weight = sentence.length
    
    // 标点符号增加停顿时间
    const punctuationCount = (sentence.match(/[。！？；，、]/g) || []).length
    weight += punctuationCount * 2 // 每个标点增加2个字符的权重
    
    // 英文单词需要更多时间
    const englishWords = (sentence.match(/[a-zA-Z]+/g) || []).length
    weight += englishWords * 1.5 // 英文单词额外权重
    
    return Math.max(1, weight) // 最小权重为1
  })

  const totalWeight = sentenceWeights.reduce((sum, weight) => sum + weight, 0)
  
  // 预留句子间的停顿时间
  const pauseTime = 0.3 // 每个句子间300ms停顿
  const totalPauseTime = (sentences.length - 1) * pauseTime
  const availableTime = Math.max(totalDuration - totalPauseTime, totalDuration * 0.8)

  let currentTime = 0
  const result = []

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i]
    const weight = sentenceWeights[i]
    
    // 基于权重分配时间
    const duration = (weight / totalWeight) * availableTime
    
    const start = currentTime
    currentTime += duration
    
    // 添加句子间停顿（除了最后一个句子）
    if (i < sentences.length - 1) {
      currentTime += pauseTime
    }
    
    const end = Math.min(currentTime, totalDuration)

    result.push({
      text: sentence,
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
    })
  }

  // 确保最后一个句子结束时间等于总时长
  if (result.length > 0) {
    result[result.length - 1].end = totalDuration
  }

  return result
}

/**
 * 验证时间戳数据的有效性
 * @param timestamp 时间戳对象
 * @returns 是否有效
 */
export function isValidTimestamp(timestamp: any): timestamp is { text: string; start: number; end?: number } {
  return (
    timestamp &&
    typeof timestamp === "object" &&
    typeof timestamp.text === "string" &&
    timestamp.text.trim().length > 0 &&
    typeof timestamp.start === "number" &&
    !isNaN(timestamp.start) &&
    timestamp.start >= 0 &&
    (timestamp.end === undefined || (typeof timestamp.end === "number" && !isNaN(timestamp.end) && timestamp.end >= timestamp.start))
  )
}

/**
 * 处理和验证时间戳数组
 * @param timestamps 原始时间戳数组
 * @param totalDuration 音频总时长（可选，用于验证）
 * @returns 验证并处理后的时间戳数组
 */
export function processTimestamps(
  timestamps: any[],
  totalDuration?: number,
): Array<{ text: string; start: number; end?: number }> {
  if (!Array.isArray(timestamps)) {
    console.warn("Timestamps is not an array, returning empty array")
    return []
  }

  const validTimestamps = timestamps.filter((ts, index) => {
    const isValid = isValidTimestamp(ts)
    if (!isValid) {
      console.warn(`Invalid timestamp at index ${index}:`, ts)
    }
    return isValid
  })

  // 计算每个句子的结束时间
  const processed = [...validTimestamps]
  for (let i = 0; i < processed.length; i++) {
    if (i < processed.length - 1) {
      // 设置当前句子的结束时间为下一个句子的开始时间
      processed[i].end = processed[i + 1].start
    } else if (totalDuration && typeof totalDuration === "number" && !isNaN(totalDuration)) {
      // 最后一个句子的结束时间设置为音频总时长
      processed[i].end = totalDuration
    }
  }

  return processed
}

/**
 * 根据当前播放时间获取当前句子索引
 * @param timestampedSentences 带时间戳的句子数组
 * @param currentTime 当前播放时间（秒）
 * @param tolerance 时间容差（秒），默认为0.1秒
 * @returns 当前句子的索引
 */
export function getCurrentSentenceIndex(
  timestampedSentences: Array<{ text: string; start: number; end?: number }>,
  currentTime: number,
  tolerance: number = 0.1,
): number {
  // 验证输入参数
  if (!Array.isArray(timestampedSentences) || timestampedSentences.length === 0) {
    return -1
  }

  if (typeof currentTime !== "number" || isNaN(currentTime) || currentTime < 0) {
    return -1
  }

  // 确保容差为有效值
  const safeTolerance = typeof tolerance === "number" && !isNaN(tolerance) && tolerance >= 0 ? tolerance : 0.1

  // 首先进行精确匹配
  for (let i = 0; i < timestampedSentences.length; i++) {
    const sentence = timestampedSentences[i]
    const startTime = sentence.start
    const endTime = sentence.end || (i < timestampedSentences.length - 1 ? timestampedSentences[i + 1].start : Infinity)
    
    // 精确匹配：当前时间在句子的开始和结束时间之间
    if (currentTime >= startTime && currentTime < endTime) {
      return i
    }
  }

  // 如果精确匹配失败，尝试容差匹配
  for (let i = 0; i < timestampedSentences.length; i++) {
    const sentence = timestampedSentences[i]
    const startTime = sentence.start
    const endTime = sentence.end || (i < timestampedSentences.length - 1 ? timestampedSentences[i + 1].start : Infinity)
    
    // 容差匹配：允许一定的时间偏差
    if (currentTime >= startTime - safeTolerance && currentTime < endTime + safeTolerance) {
      return i
    }
  }

  // 边界情况处理
  const firstSentence = timestampedSentences[0]
  const lastSentence = timestampedSentences[timestampedSentences.length - 1]

  // 如果当前时间在第一个句子之前（但在容差范围内），返回第一个句子
  if (currentTime < firstSentence.start && currentTime >= firstSentence.start - safeTolerance) {
    return 0
  }

  // 如果当前时间在最后一个句子之后，返回最后一个句子
  if (currentTime >= lastSentence.start) {
    return timestampedSentences.length - 1
  }

  // 找到最接近的句子（最小时间差）
  let closestIndex = -1
  let minTimeDiff = Infinity

  for (let i = 0; i < timestampedSentences.length; i++) {
    const sentence = timestampedSentences[i]
    const timeDiff = Math.abs(currentTime - sentence.start)
    
    if (timeDiff < minTimeDiff) {
      minTimeDiff = timeDiff
      closestIndex = i
    }
  }

  // 只有在时间差小于较大的容差时才返回最接近的句子
  if (minTimeDiff <= safeTolerance * 3) {
    return closestIndex
  }

  return -1 // 没有找到匹配的句子
}
