"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Play, Pause, SkipBack, SkipForward, Download, Settings } from "lucide-react"
import {
  splitIntoSentences,
  estimateTimestamps,
  getCurrentSentenceIndex,
  adjustTimestamps,
} from "@/utils/text-processor"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"

interface SyncAudioPlayerProps {
  audioUrl: string
  text: string
  languageCode?: string
  onDownload?: () => void
}

export default function SyncAudioPlayer({ audioUrl, text, languageCode = "cmn-CN", onDownload }: SyncAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const sentencesRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [timestampedSentences, setTimestampedSentences] = useState<Array<{ text: string; start: number; end: number }>>(
    [],
  )
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(-1)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isInitialized, setIsInitialized] = useState(false)

  // 分割文本并初始化时间戳
  useEffect(() => {
    const sentences = splitIntoSentences(text)
    // 初始时使用估计的总时长，后续会更新
    const initialDuration = text.length * 0.1 // 粗略估计：每个字符0.1秒
    setTimestampedSentences(estimateTimestamps(sentences, initialDuration, languageCode))
  }, [text, languageCode])

  // 音频加载完成后更新实际时长和时间戳
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      const actualDuration = audio.duration
      setDuration(actualDuration)
      setIsInitialized(true)

      // 使用实际时长重新计算时间戳
      const sentences = splitIntoSentences(text)
      setTimestampedSentences(estimateTimestamps(sentences, actualDuration, languageCode))
    }

    audio.addEventListener("loadedmetadata", handleLoadedMetadata)
    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata)
    }
  }, [text, languageCode])

  // 监听播放进度
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      const index = getCurrentSentenceIndex(timestampedSentences, audio.currentTime)

      if (index !== currentSentenceIndex) {
        setCurrentSentenceIndex(index)

        // 滚动到当前句子
        if (index >= 0 && sentencesRef.current) {
          const sentenceElements = sentencesRef.current.children
          if (sentenceElements[index]) {
            sentenceElements[index].scrollIntoView({
              behavior: "smooth",
              block: "center",
            })
          }
        }
      }
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
  }, [timestampedSentences, currentSentenceIndex])

  // 播放/暂停控制
  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play().catch((error) => {
        console.error("播放失败:", error)
      })
    }
  }, [isPlaying])

  // 跳转到上一句
  const skipToPreviousSentence = useCallback(() => {
    if (currentSentenceIndex <= 0 || timestampedSentences.length === 0) return

    const newIndex = Math.max(0, currentSentenceIndex - 1)
    jumpToSentence(newIndex)
  }, [currentSentenceIndex, timestampedSentences])

  // 跳转到下一句
  const skipToNextSentence = useCallback(() => {
    if (currentSentenceIndex >= timestampedSentences.length - 1 || timestampedSentences.length === 0) return

    const newIndex = Math.min(timestampedSentences.length - 1, currentSentenceIndex + 1)
    jumpToSentence(newIndex)
  }, [currentSentenceIndex, timestampedSentences])

  // 点击句子跳转
  const jumpToSentence = useCallback(
    (index: number) => {
      if (index < 0 || index >= timestampedSentences.length || !isInitialized) return

      const audio = audioRef.current
      if (audio) {
        // 添加小偏移量，确保跳转到句子的真正开始
        const jumpTime = Math.max(0, timestampedSentences[index].start - 0.05)
        audio.currentTime = jumpTime

        // 更新当前句子索引
        setCurrentSentenceIndex(index)

        // 如果没有播放，则开始播放
        if (!isPlaying) {
          audio.play().catch((error) => {
            console.error("播放失败:", error)
          })
        }

        // 动态调整后续句子的时间戳
        setTimestampedSentences((prevTimestamps) => adjustTimestamps(prevTimestamps, index, jumpTime))
      }
    },
    [timestampedSentences, isPlaying, isInitialized],
  )

  // 设置播放速度
  const handlePlaybackRateChange = useCallback((value: number[]) => {
    const newRate = value[0]
    setPlaybackRate(newRate)

    const audio = audioRef.current
    if (audio) {
      audio.playbackRate = newRate
    }
  }, [])

  // 格式化时间
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  // 处理进度条拖动
  const handleProgressChange = useCallback(
    (value: number[]) => {
      const newTime = (value[0] / 100) * duration

      const audio = audioRef.current
      if (audio) {
        audio.currentTime = newTime
      }
    },
    [duration],
  )

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
              disabled={currentSentenceIndex <= 0 || !isInitialized}
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button variant="outline" size="icon" onClick={togglePlayPause} disabled={!isInitialized}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={skipToNextSentence}
              disabled={currentSentenceIndex >= timestampedSentences.length - 1 || !isInitialized}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>

          <div className="flex items-center space-x-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-4">
                        <h4 className="font-medium">播放设置</h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="playback-rate">播放速度: {playbackRate.toFixed(1)}x</Label>
                          </div>
                          <Slider
                            id="playback-rate"
                            min={0.5}
                            max={2}
                            step={0.1}
                            value={[playbackRate]}
                            onValueChange={handlePlaybackRateChange}
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </TooltipTrigger>
                <TooltipContent>
                  <p>播放设置</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {onDownload && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={onDownload}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>下载音频</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        {/* 进度条 */}
        <div className="space-y-2">
          <Slider
            value={[duration ? (currentTime / duration) * 100 : 0]}
            min={0}
            max={100}
            step={0.1}
            onValueChange={handleProgressChange}
            disabled={!isInitialized}
            aria-label="音频进度"
          />
        </div>

        {/* 句子显示区域 */}
        <div
          ref={sentencesRef}
          className="mt-4 max-h-60 overflow-y-auto border rounded-md p-3 space-y-1"
          aria-live="polite"
        >
          {timestampedSentences.map((sentence, index) => (
            <p
              key={index}
              className={`py-1.5 px-2 rounded cursor-pointer transition-colors ${
                index === currentSentenceIndex
                  ? "bg-primary/20 font-medium border-l-4 border-primary"
                  : "hover:bg-muted"
              }`}
              onClick={() => jumpToSentence(index)}
              data-start-time={sentence.start.toFixed(2)}
              data-end-time={sentence.end.toFixed(2)}
              aria-current={index === currentSentenceIndex ? "true" : "false"}
            >
              {sentence.text}
            </p>
          ))}
          {timestampedSentences.length === 0 && isInitialized && (
            <p className="text-center text-muted-foreground py-4">无法分割文本为句子，请检查文本内容</p>
          )}
          {!isInitialized && (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
