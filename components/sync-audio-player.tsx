"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Play, Pause, SkipBack, SkipForward, Download } from "lucide-react"

interface SentenceTimestamp {
  text: string
  start: number
  end?: number
}

interface SyncAudioPlayerProps {
  audioUrl: string
  text: string
  sentenceTimestamps?: SentenceTimestamp[]
  onDownload?: () => void
}

export default function SyncAudioPlayer({ audioUrl, text, sentenceTimestamps = [], onDownload }: SyncAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [processedTimestamps, setProcessedTimestamps] = useState<SentenceTimestamp[]>([])
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(-1)
  const [isAudioLoaded, setIsAudioLoaded] = useState(false)
  const [audioLoadError, setAudioLoadError] = useState<string | null>(null)
  const [audioLoadingState, setAudioLoadingState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [audioMetadataLoaded, setAudioMetadataLoaded] = useState(false)
  
  // 添加防抖和性能优化的refs
  const lastUpdateTime = useRef<number>(0)
  const timeUpdateThrottle = useRef<number | null>(null)
  const lastSentenceIndex = useRef<number>(-1)

  // 获取当前句子索引，使用改进的函数
  const getCurrentSentenceIndex = useCallback(
    (currentTime: number): number => {
      if (processedTimestamps.length === 0) {
        return -1
      }

      // 验证输入参数
      if (typeof currentTime !== "number" || isNaN(currentTime) || currentTime < 0) {
        return -1
      }

      // 使用改进的算法，包含容差机制
      const tolerance = 0.15 // 150ms容差，适应音频播放的微小延迟

      // 首先进行精确匹配
      for (let i = 0; i < processedTimestamps.length; i++) {
        const sentence = processedTimestamps[i]
        const startTime = sentence.start
        const endTime = sentence.end || (i < processedTimestamps.length - 1 ? processedTimestamps[i + 1].start : Infinity)
        
        // 精确匹配：当前时间在句子的开始和结束时间之间
        if (currentTime >= startTime && currentTime < endTime) {
          return i
        }
      }

      // 如果精确匹配失败，尝试容差匹配
      for (let i = 0; i < processedTimestamps.length; i++) {
        const sentence = processedTimestamps[i]
        const startTime = sentence.start
        const endTime = sentence.end || (i < processedTimestamps.length - 1 ? processedTimestamps[i + 1].start : Infinity)
        
        // 容差匹配：允许一定的时间偏差
        if (currentTime >= startTime - tolerance && currentTime < endTime + tolerance) {
          return i
        }
      }

      // 边界情况处理
      const firstSentence = processedTimestamps[0]
      const lastSentence = processedTimestamps[processedTimestamps.length - 1]

      // 如果当前时间在第一个句子之前（但在容差范围内），返回第一个句子
      if (currentTime < firstSentence.start && currentTime >= firstSentence.start - tolerance) {
        return 0
      }

      // 如果当前时间在最后一个句子之后，返回最后一个句子
      if (currentTime >= lastSentence.start) {
        return processedTimestamps.length - 1
      }

      // 特殊处理：如果只有一个句子且时间在合理范围内，始终高亮该句子
      if (processedTimestamps.length === 1 && currentTime >= 0) {
        return 0
      }

      return -1
    },
    [processedTimestamps],
  )

  // 优化的时间更新函数，使用节流机制
  const throttledTimeUpdate = useCallback((newTime: number) => {
    const now = Date.now()
    const UPDATE_INTERVAL = 100 // 100ms更新间隔，降低CPU使用率

    // 清除之前的定时器
    if (timeUpdateThrottle.current) {
      clearTimeout(timeUpdateThrottle.current)
    }

    // 如果距离上次更新时间太短，使用定时器延迟更新
    if (now - lastUpdateTime.current < UPDATE_INTERVAL) {
      timeUpdateThrottle.current = window.setTimeout(() => {
        setCurrentTime(newTime)
        lastUpdateTime.current = Date.now()
        
        // 只有在句子索引发生变化时才更新
        const newSentenceIndex = getCurrentSentenceIndex(newTime)
        if (newSentenceIndex !== lastSentenceIndex.current) {
          setCurrentSentenceIndex(newSentenceIndex)
          lastSentenceIndex.current = newSentenceIndex
        }
      }, UPDATE_INTERVAL - (now - lastUpdateTime.current))
    } else {
      // 立即更新
      setCurrentTime(newTime)
      lastUpdateTime.current = now
      
      // 只有在句子索引发生变化时才更新
      const newSentenceIndex = getCurrentSentenceIndex(newTime)
      if (newSentenceIndex !== lastSentenceIndex.current) {
        setCurrentSentenceIndex(newSentenceIndex)
        lastSentenceIndex.current = newSentenceIndex
      }
    }
  }, [getCurrentSentenceIndex])

  // 清理函数
  useEffect(() => {
    return () => {
      if (timeUpdateThrottle.current) {
        clearTimeout(timeUpdateThrottle.current)
      }
    }
  }, [])

  // 音频URL变化时重置状态
  useEffect(() => {
    if (audioUrl) {
      setAudioLoadingState('loading')
      setAudioLoadError(null)
      setIsAudioLoaded(false)
      setAudioMetadataLoaded(false)
      setCurrentTime(0)
      setCurrentSentenceIndex(-1)
      setIsPlaying(false)
    }
  }, [audioUrl])

  // 调试信息
  useEffect(() => {
  }, [sentenceTimestamps])

  // 处理时间戳，使用改进的验证和处理逻辑
  useEffect(() => {
    if (sentenceTimestamps.length > 0) {

      // 使用统一的时间戳处理函数
      import("@/utils/text-processor").then(({ processTimestamps }) => {
        const processed = processTimestamps(sentenceTimestamps, duration || undefined)
        setProcessedTimestamps(processed)
      })
    } else if (text && isAudioLoaded) {
      // 如果没有提供时间戳，则使用备用方法
      import("@/utils/text-processor").then(({ splitIntoSentences, estimateTimestamps }) => {
        const sentences = splitIntoSentences(text)
        const estimatedTimestamps = estimateTimestamps(sentences, duration || text.length * 0.1)
        setProcessedTimestamps(estimatedTimestamps)
      })
    }
  }, [sentenceTimestamps, text, duration, isAudioLoaded])

  // 音频加载完成后更新实际时长和时间戳，增强状态管理
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadStart = () => {
      setAudioLoadingState('loading')
      setAudioLoadError(null)
    }

    const handleLoadedMetadata = () => {
      try {
        const actualDuration = audio.duration
        
        if (isNaN(actualDuration) || actualDuration <= 0) {
          setAudioLoadError("音频时长无效")
          setAudioLoadingState('error')
          return
        }

        setDuration(actualDuration)
        setAudioMetadataLoaded(true)
        setAudioLoadingState('loaded')

        // 动态校准时间戳 - 使用实际音频时长
        if (processedTimestamps.length > 0) {
          import("@/utils/text-processor").then(({ estimateTimestamps, splitIntoSentences }) => {
            
            // 检查估算时长与实际时长的差异
            const estimatedDuration = processedTimestamps.length > 0 ? 
              Math.max(...processedTimestamps.map(ts => ts.end || ts.start)) : 0
            
            const durationDiff = Math.abs(actualDuration - estimatedDuration)
            const diffPercentage = estimatedDuration > 0 ? durationDiff / estimatedDuration : 1
            
            
            // 如果差异超过20%，重新计算时间戳
            if (diffPercentage > 0.2) {
              const sentences = processedTimestamps.map(ts => ts.text)
              const recalibratedTimestamps = estimateTimestamps(sentences, actualDuration)
              setProcessedTimestamps(recalibratedTimestamps)
            } else {
              // 小幅调整：按比例缩放现有时间戳
              const scaleFactor = actualDuration / estimatedDuration
              const scaledTimestamps = processedTimestamps.map(ts => ({
                ...ts,
                start: ts.start * scaleFactor,
                end: ts.end ? ts.end * scaleFactor : actualDuration,
              }))
              
              // 确保最后一个句子结束于实际时长
              if (scaledTimestamps.length > 0) {
                scaledTimestamps[scaledTimestamps.length - 1].end = actualDuration
              }
              
              setProcessedTimestamps(scaledTimestamps)
            }
          })
        }
      } catch (error) {
        console.error("Error in handleLoadedMetadata:", error)
        setAudioLoadError("音频元数据加载失败")
        setAudioLoadingState('error')
      }
    }

    const handleCanPlay = () => {
      setIsAudioLoaded(true)
    }

    const handleLoadError = (event: Event) => {
      console.error("Audio load error:", event)
      setAudioLoadError("音频加载失败")
      setAudioLoadingState('error')
      setIsAudioLoaded(false)
    }

    const handleStalled = () => {
      // 不改变状态，只记录警告
    }

    const handleProgress = () => {
      if (audio.buffered.length > 0) {
        const bufferedEnd = audio.buffered.end(audio.buffered.length - 1)
        const duration = audio.duration
        if (duration > 0) {
          const bufferedPercent = (bufferedEnd / duration) * 100
        }
      }
    }

    audio.addEventListener("loadstart", handleLoadStart)
    audio.addEventListener("loadedmetadata", handleLoadedMetadata)
    audio.addEventListener("canplay", handleCanPlay)
    audio.addEventListener("error", handleLoadError)
    audio.addEventListener("stalled", handleStalled)
    audio.addEventListener("progress", handleProgress)

    return () => {
      try {
        audio.removeEventListener("loadstart", handleLoadStart)
        audio.removeEventListener("loadedmetadata", handleLoadedMetadata)
        audio.removeEventListener("canplay", handleCanPlay)
        audio.removeEventListener("error", handleLoadError)
        audio.removeEventListener("stalled", handleStalled)
        audio.removeEventListener("progress", handleProgress)
      } catch (error) {
        console.error("Error removing audio load event listeners:", error)
      }
    }
  }, [text, sentenceTimestamps]) // 移除processedTimestamps依赖以避免循环

  // 监听播放进度，增强错误处理
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    const handleTimeUpdate = () => {
      try {
        if (audio.currentTime !== undefined && !isNaN(audio.currentTime)) {
          // 使用节流的时间更新函数
          throttledTimeUpdate(audio.currentTime)
        } else {
        }
      } catch (error) {
        console.error("Error in handleTimeUpdate:", error)
      }
    }

    const handlePlay = () => {
      try {
        setIsPlaying(true)
      } catch (error) {
        console.error("Error in handlePlay:", error)
      }
    }

    const handlePause = () => {
      try {
        setIsPlaying(false)
      } catch (error) {
        console.error("Error in handlePause:", error)
      }
    }

    const handleEnded = () => {
      try {
        setIsPlaying(false)
        setCurrentSentenceIndex(-1) // 重置当前句子索引
      } catch (error) {
        console.error("Error in handleEnded:", error)
      }
    }

    const handleError = (event: Event) => {
      console.error("Audio playback error:", event)
      setIsPlaying(false)
    }

    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("play", handlePlay)
    audio.addEventListener("pause", handlePause)
    audio.addEventListener("ended", handleEnded)
    audio.addEventListener("error", handleError)

    return () => {
      try {
        audio.removeEventListener("timeupdate", handleTimeUpdate)
        audio.removeEventListener("play", handlePlay)
        audio.removeEventListener("pause", handlePause)
        audio.removeEventListener("ended", handleEnded)
        audio.removeEventListener("error", handleError)
      } catch (error) {
        console.error("Error removing audio event listeners:", error)
      }
    }
  }, [throttledTimeUpdate]) // 使用throttledTimeUpdate而不是getCurrentSentenceIndex

  // 播放/暂停控制，考虑音频加载状态
  const togglePlayPause = () => {
    const audio = audioRef.current
    if (!audio) {
      console.error("Audio element not available for play/pause control")
      return
    }

    // 检查音频加载状态
    if (audioLoadingState === 'loading') {
      return
    }

    if (audioLoadingState === 'error') {
      console.error("Audio has load error, cannot play")
      return
    }

    if (!isAudioLoaded) {
      return
    }

    try {
      if (isPlaying) {
        audio.pause()
      } else {
        // 确保音频元数据已加载
        if (!audioMetadataLoaded) {
          audio.load() // 重新加载音频
          return
        }

        audio.play().catch((error) => {
          console.error("Audio play failed:", error)
          setIsPlaying(false) // 确保状态同步
          
          // 尝试重新加载音频
          if (error.name === 'NotAllowedError') {
          } else {
            audio.load()
          }
        })
      }
    } catch (error) {
      console.error("Error in togglePlayPause:", error)
      setIsPlaying(false)
    }
  }

  // 跳转到上一句，增强错误处理
  const skipToPreviousSentence = () => {
    try {
      if (currentSentenceIndex <= 0 || processedTimestamps.length === 0) {
        return
      }

      const newIndex = Math.max(0, currentSentenceIndex - 1)
      jumpToSentence(newIndex)
    } catch (error) {
      console.error("Error in skipToPreviousSentence:", error)
    }
  }

  // 跳转到下一句，增强错误处理
  const skipToNextSentence = () => {
    try {
      if (currentSentenceIndex >= processedTimestamps.length - 1 || processedTimestamps.length === 0) {
        return
      }

      const newIndex = Math.min(processedTimestamps.length - 1, currentSentenceIndex + 1)
      jumpToSentence(newIndex)
    } catch (error) {
      console.error("Error in skipToNextSentence:", error)
    }
  }

  // 点击句子跳转，增强错误处理
  const jumpToSentence = (index: number) => {
    try {
      // 验证输入参数
      if (typeof index !== "number" || isNaN(index)) {
        console.error("Invalid sentence index:", index)
        return
      }

      if (index < 0 || index >= processedTimestamps.length) {
        return
      }

      const audio = audioRef.current
      if (!audio) {
        console.error("Audio element not available for sentence jumping")
        return
      }

      const sentence = processedTimestamps[index]
      if (!sentence) {
        console.error(`No sentence found at index ${index}`)
        return
      }

      const startTime = sentence.start

      // 验证音频元素状态
      if (isNaN(audio.duration) || audio.duration === 0) {
      }

      // 确保时间在有效范围内
      if (typeof startTime === "number" && !isNaN(startTime) && startTime >= 0) {
        if (audio.duration && startTime <= audio.duration) {
          // 跳转到句子的开始时间
          audio.currentTime = startTime
        } else if (!audio.duration) {
          // 如果音频还在加载，直接设置时间
          audio.currentTime = startTime
        } else {
          audio.currentTime = Math.min(startTime, audio.duration)
        }

        // 如果没有播放，则开始播放
        if (!isPlaying) {
          audio.play().catch((error) => {
            console.error("Failed to start playback after sentence jump:", error)
            setIsPlaying(false)
          })
        }
      } else {
        console.error(`Invalid start time: ${startTime}, defaulting to beginning of audio`)
        // 如果时间无效，默认跳转到音频开始
        audio.currentTime = 0

        // 如果没有播放，则开始播放
        if (!isPlaying) {
          audio.play().catch((error) => {
            console.error("Failed to start playback after fallback jump:", error)
            setIsPlaying(false)
          })
        }
      }
    } catch (error) {
      console.error("Error in jumpToSentence:", error)
    }
  }

  // 格式化时间，增强错误处理
  const formatTime = (time: number) => {
    try {
      // 验证输入
      if (typeof time !== "number" || isNaN(time) || time < 0) {
        return "0:00"
      }

      // 处理无穷大的情况
      if (!isFinite(time)) {
        return "0:00"
      }

      const minutes = Math.floor(time / 60)
      const seconds = Math.floor(time % 60)
      return `${minutes}:${seconds.toString().padStart(2, "0")}`
    } catch (error) {
      console.error("Error in formatTime:", error)
      return "0:00"
    }
  }

  return (
    <Card className="w-full">
      <CardContent className="p-4 space-y-4">
        {/* 隐藏的音频元素 */}
        <audio ref={audioRef} src={audioUrl} preload="metadata" />

        {/* 播放控制器 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={skipToPreviousSentence} 
              disabled={currentSentenceIndex <= 0 || audioLoadingState !== 'loaded' || !isAudioLoaded}
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button 
              variant="outline" 
              size="icon" 
              onClick={togglePlayPause}
              disabled={audioLoadingState === 'loading' || audioLoadingState === 'error' || !isAudioLoaded}
            >
              {audioLoadingState === 'loading' ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={skipToNextSentence}
              disabled={currentSentenceIndex >= processedTimestamps.length - 1 || audioLoadingState !== 'loaded' || !isAudioLoaded}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>

          {onDownload && (
            <Button variant="outline" size="icon" onClick={onDownload}>
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* 错误状态显示 */}
        {audioLoadError && (
          <div className="px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">
              ⚠️ {audioLoadError}
            </p>
          </div>
        )}

        {/* 加载状态显示 */}
        {audioLoadingState === 'loading' && (
          <div className="px-3 py-2 bg-muted rounded-md">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              正在加载音频...
            </p>
          </div>
        )}

        {/* 进度条 */}
        <div className="relative w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-primary"
            style={{ 
              width: useMemo(() => {
                if (!duration || duration === 0) return '0%'
                const percentage = Math.min(100, Math.max(0, (currentTime / duration) * 100))
                return `${percentage}%`
              }, [currentTime, duration])
            }}
          />
        </div>

        {/* 句子显示区域 */}
        <div className="mt-4 max-h-60 overflow-y-auto border rounded-md p-3">
          {processedTimestamps.length > 0 ? (
            processedTimestamps.map((sentence, index) => (
              <p
                key={index}
                className={`py-1 px-2 my-1 rounded cursor-pointer transition-colors ${
                  index === currentSentenceIndex
                    ? "bg-primary/20 font-medium border-l-4 border-primary"
                    : "hover:bg-muted"
                }`}
                onClick={() => jumpToSentence(index)}
                data-start-time={sentence.start}
                data-end-time={sentence.end}
              >
                {sentence.text}
              </p>
            ))
          ) : (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
