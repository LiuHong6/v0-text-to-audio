"use client"

import { useState, useRef, useEffect, useCallback } from "react"
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

  // 调试信息
  useEffect(() => {
    console.log("Received sentenceTimestamps:", sentenceTimestamps)
  }, [sentenceTimestamps])

  // 处理时间戳，计算每个句子的结束时间
  useEffect(() => {
    if (sentenceTimestamps.length > 0) {
      console.log("Processing timestamps:", sentenceTimestamps)

      // 验证时间戳数据的有效性
      const validTimestamps = sentenceTimestamps.map((stamp, index) => {
        // 确保start是一个有效的数字
        const start = typeof stamp.start === "number" && !isNaN(stamp.start) ? stamp.start : 0

        return {
          ...stamp,
          start,
        }
      })

      // 计算每个句子的结束时间
      const processed = [...validTimestamps]
      for (let i = 0; i < processed.length; i++) {
        if (i < processed.length - 1) {
          processed[i].end = processed[i + 1].start
        }
      }

      console.log("Processed timestamps:", processed)
      setProcessedTimestamps(processed)
    } else if (text && isAudioLoaded) {
      // 如果没有提供时间戳，则使用备用方法
      console.log("No timestamps provided, using fallback method")
      import("@/utils/text-processor").then(({ splitIntoSentences, estimateTimestamps }) => {
        const sentences = splitIntoSentences(text)
        const estimatedTimestamps = estimateTimestamps(sentences, duration || text.length * 0.1)
        console.log("Estimated timestamps:", estimatedTimestamps)
        setProcessedTimestamps(estimatedTimestamps)
      })
    }
  }, [sentenceTimestamps, text, duration, isAudioLoaded])

  // 音频加载完成后更新实际时长和时间戳
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      const actualDuration = audio.duration
      setDuration(actualDuration)
      setIsAudioLoaded(true)

      // 如果使用的是估算的时间戳，则使用实际时长重新计算
      if (sentenceTimestamps.length === 0 && processedTimestamps.length > 0) {
        import("@/utils/text-processor").then(({ splitIntoSentences, estimateTimestamps }) => {
          const sentences = splitIntoSentences(text)
          setProcessedTimestamps(estimateTimestamps(sentences, actualDuration))
        })
      } else if (processedTimestamps.length > 0) {
        // 为最后一个句子设置结束时间
        const updated = [...processedTimestamps]
        updated[updated.length - 1].end = actualDuration
        setProcessedTimestamps(updated)
      }
    }

    audio.addEventListener("loadedmetadata", handleLoadedMetadata)
    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata)
    }
  }, [text, processedTimestamps, sentenceTimestamps])

  // 获取当前句子索引
  const getCurrentSentenceIndex = useCallback(
    (currentTime: number): number => {
      for (let i = 0; i < processedTimestamps.length; i++) {
        const sentence = processedTimestamps[i]
        if (currentTime >= sentence.start && (!sentence.end || currentTime < sentence.end)) {
          return i
        }
      }

      // 如果当前时间超出所有句子，返回最后一个句子
      if (processedTimestamps.length > 0 && currentTime >= processedTimestamps[processedTimestamps.length - 1].start) {
        return processedTimestamps.length - 1
      }

      return -1
    },
    [processedTimestamps],
  )

  // 监听播放进度
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      const index = getCurrentSentenceIndex(audio.currentTime)
      setCurrentSentenceIndex(index)
    }

    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("play", () => setIsPlaying(true))
    audio.addEventListener("pause", () => setIsPlaying(false))
    audio.addEventListener("ended", () => setIsPlaying(false))

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      audio.removeEventListener("play", () => setIsPlaying(true))
      audio.removeEventListener("pause", () => setIsPlaying(false))
      audio.removeEventListener("ended", () => setIsPlaying(false))
    }
  }, [getCurrentSentenceIndex])

  // 播放/暂停控制
  const togglePlayPause = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play().catch((error) => {
        console.error("播放失败:", error)
      })
    }
  }

  // 跳转到上一句
  const skipToPreviousSentence = () => {
    if (currentSentenceIndex <= 0 || processedTimestamps.length === 0) return

    const newIndex = Math.max(0, currentSentenceIndex - 1)
    jumpToSentence(newIndex)
  }

  // 跳转到下一句
  const skipToNextSentence = () => {
    if (currentSentenceIndex >= processedTimestamps.length - 1 || processedTimestamps.length === 0) return

    const newIndex = Math.min(processedTimestamps.length - 1, currentSentenceIndex + 1)
    jumpToSentence(newIndex)
  }

  // 点击句子跳转
  const jumpToSentence = (index: number) => {
    if (index < 0 || index >= processedTimestamps.length) return

    const audio = audioRef.current
    if (audio) {
      const startTime = processedTimestamps[index].start
      console.log(`Jumping to sentence ${index} at time ${startTime}`)

      // 确保时间在有效范围内
      if (typeof startTime === "number" && !isNaN(startTime) && startTime >= 0 && startTime <= audio.duration) {
        // 跳转到句子的开始时间
        audio.currentTime = startTime

        // 如果没有播放，则开始播放
        if (!isPlaying) {
          audio.play().catch((error) => {
            console.error("播放失败:", error)
          })
        }
      } else {
        console.error(`Invalid start time: ${startTime}, defaulting to beginning of audio`)
        // 如果时间无效，默认跳转到音频开始
        audio.currentTime = 0

        // 如果没有播放，则开始播放
        if (!isPlaying) {
          audio.play().catch((error) => {
            console.error("播放失败:", error)
          })
        }
      }
    }
  }

  // 格式化时间
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  return (
    <Card className="w-full">
      <CardContent className="p-4 space-y-4">
        {/* 隐藏的音频元素 */}
        <audio ref={audioRef} src={audioUrl} preload="metadata" />

        {/* 播放控制器 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="icon" onClick={skipToPreviousSentence} disabled={currentSentenceIndex <= 0}>
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button variant="outline" size="icon" onClick={togglePlayPause}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={skipToNextSentence}
              disabled={currentSentenceIndex >= processedTimestamps.length - 1}
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

        {/* 进度条 */}
        <div className="relative w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-primary"
            style={{ width: `${(currentTime / duration) * 100}%` }}
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
