"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Play, Pause, SkipBack, SkipForward, Download } from "lucide-react"
import { splitIntoSentences, estimateTimestamps, getCurrentSentenceIndex } from "@/utils/text-processor"

interface SyncAudioPlayerProps {
  audioUrl: string
  text: string
  onDownload?: () => void
}

export default function SyncAudioPlayer({ audioUrl, text, onDownload }: SyncAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [timestampedSentences, setTimestampedSentences] = useState<Array<{ text: string; start: number; end: number }>>(
    [],
  )
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(-1)

  // 初始化时分割文本
  useEffect(() => {
    const sentences = splitIntoSentences(text)
    // 初始时使用估计的总时长，后续会更新
    const initialDuration = text.length * 0.1 // 粗略估计：每个字符0.1秒
    setTimestampedSentences(estimateTimestamps(sentences, initialDuration))
  }, [text])

  // 音频加载完成后更新实际时长和时间戳
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      const actualDuration = audio.duration
      setDuration(actualDuration)

      // 使用实际时长重新计算时间戳
      const sentences = splitIntoSentences(text)
      setTimestampedSentences(estimateTimestamps(sentences, actualDuration))
    }

    audio.addEventListener("loadedmetadata", handleLoadedMetadata)
    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata)
    }
  }, [text])

  // 监听播放进度
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      const index = getCurrentSentenceIndex(timestampedSentences, audio.currentTime)
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
  }, [timestampedSentences])

  // 播放/暂停控制
  const togglePlayPause = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
  }

  // 跳转到上一句
  const skipToPreviousSentence = () => {
    if (currentSentenceIndex <= 0 || timestampedSentences.length === 0) return

    const newIndex = Math.max(0, currentSentenceIndex - 1)
    const audio = audioRef.current
    if (audio) {
      audio.currentTime = timestampedSentences[newIndex].start
      if (!isPlaying) {
        audio.play()
      }
    }
  }

  // 跳转到下一句
  const skipToNextSentence = () => {
    if (currentSentenceIndex >= timestampedSentences.length - 1 || timestampedSentences.length === 0) return

    const newIndex = Math.min(timestampedSentences.length - 1, currentSentenceIndex + 1)
    const audio = audioRef.current
    if (audio) {
      audio.currentTime = timestampedSentences[newIndex].start
      if (!isPlaying) {
        audio.play()
      }
    }
  }

  // 点击句子跳转
  const jumpToSentence = (index: number) => {
    if (index < 0 || index >= timestampedSentences.length) return

    const audio = audioRef.current
    if (audio) {
      audio.currentTime = timestampedSentences[index].start
      if (!isPlaying) {
        audio.play()
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
              disabled={currentSentenceIndex >= timestampedSentences.length - 1}
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
          {timestampedSentences.map((sentence, index) => (
            <p
              key={index}
              className={`py-1 px-2 my-1 rounded cursor-pointer transition-colors ${
                index === currentSentenceIndex ? "bg-primary/20 font-medium" : "hover:bg-muted"
              }`}
              onClick={() => jumpToSentence(index)}
            >
              {sentence.text}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
