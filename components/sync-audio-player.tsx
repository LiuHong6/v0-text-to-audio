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
  
  // [comment removed]
  const lastUpdateTime = useRef<number>(0)
  const timeUpdateThrottle = useRef<number | null>(null)
  const lastSentenceIndex = useRef<number>(-1)

  // [comment removed]
  const getCurrentSentenceIndex = useCallback(
    (currentTime: number): number => {
      if (processedTimestamps.length === 0) {
        return -1
      }

      // [comment removed]
      if (typeof currentTime !== "number" || isNaN(currentTime) || currentTime < 0) {
        return -1
      }

      // [comment removed]
      const tolerance = 0.15 // 150ms容差，适应音频播放的微小延迟

      // [comment removed]
      for (let i = 0; i < processedTimestamps.length; i++) {
        const sentence = processedTimestamps[i]
        const startTime = sentence.start
        const endTime = sentence.end || (i < processedTimestamps.length - 1 ? processedTimestamps[i + 1].start : Infinity)
        
        // [comment removed]
        if (currentTime >= startTime && currentTime < endTime) {
          return i
        }
      }

      // [comment removed]
      for (let i = 0; i < processedTimestamps.length; i++) {
        const sentence = processedTimestamps[i]
        const startTime = sentence.start
        const endTime = sentence.end || (i < processedTimestamps.length - 1 ? processedTimestamps[i + 1].start : Infinity)
        
        // [comment removed]
        if (currentTime >= startTime - tolerance && currentTime < endTime + tolerance) {
          return i
        }
      }

      // [comment removed]
      const firstSentence = processedTimestamps[0]
      const lastSentence = processedTimestamps[processedTimestamps.length - 1]

      // [comment removed]
      if (currentTime < firstSentence.start && currentTime >= firstSentence.start - tolerance) {
        return 0
      }

      // [comment removed]
      if (currentTime >= lastSentence.start) {
        return processedTimestamps.length - 1
      }

      // [comment removed]
      if (processedTimestamps.length === 1 && currentTime >= 0) {
        return 0
      }

      return -1
    },
    [processedTimestamps],
  )

  // [comment removed]
  const throttledTimeUpdate = useCallback((newTime: number) => {
    const now = Date.now()
    const UPDATE_INTERVAL = 100 // 100ms更新间隔，降低CPU使用率

    // [comment removed]
    if (timeUpdateThrottle.current) {
      clearTimeout(timeUpdateThrottle.current)
    }

    // [comment removed]
    if (now - lastUpdateTime.current < UPDATE_INTERVAL) {
      timeUpdateThrottle.current = window.setTimeout(() => {
        setCurrentTime(newTime)
        lastUpdateTime.current = Date.now()
        
        // [comment removed]
        const newSentenceIndex = getCurrentSentenceIndex(newTime)
        if (newSentenceIndex !== lastSentenceIndex.current) {
          setCurrentSentenceIndex(newSentenceIndex)
          lastSentenceIndex.current = newSentenceIndex
        }
      }, UPDATE_INTERVAL - (now - lastUpdateTime.current))
    } else {
      // [comment removed]
      setCurrentTime(newTime)
      lastUpdateTime.current = now
      
      // [comment removed]
      const newSentenceIndex = getCurrentSentenceIndex(newTime)
      if (newSentenceIndex !== lastSentenceIndex.current) {
        setCurrentSentenceIndex(newSentenceIndex)
        lastSentenceIndex.current = newSentenceIndex
      }
    }
  }, [getCurrentSentenceIndex])

  // [comment removed]
  useEffect(() => {
    return () => {
      if (timeUpdateThrottle.current) {
        clearTimeout(timeUpdateThrottle.current)
      }
    }
  }, [])

  // [comment removed]
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

  // [comment removed]
  useEffect(() => {
  }, [sentenceTimestamps])

  // [comment removed]
  useEffect(() => {
    if (sentenceTimestamps.length > 0) {

      // [comment removed]
      import("@/utils/text-processor").then(({ processTimestamps }) => {
        const processed = processTimestamps(sentenceTimestamps, duration || undefined)
        setProcessedTimestamps(processed)
      })
    } else if (text && isAudioLoaded) {
      // [comment removed]
      import("@/utils/text-processor").then(({ splitIntoSentences, estimateTimestamps }) => {
        const sentences = splitIntoSentences(text)
        const estimatedTimestamps = estimateTimestamps(sentences, duration || text.length * 0.1)
        setProcessedTimestamps(estimatedTimestamps)
      })
    }
  }, [sentenceTimestamps, text, duration, isAudioLoaded])

  // [comment removed]
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
          setAudioLoadError("Invalid audio duration")
          setAudioLoadingState('error')
          return
        }

        setDuration(actualDuration)
        setAudioMetadataLoaded(true)
        setAudioLoadingState('loaded')

        // [comment removed]
        if (processedTimestamps.length > 0) {
          import("@/utils/text-processor").then(({ estimateTimestamps, splitIntoSentences }) => {
            
            // [comment removed]
            const estimatedDuration = processedTimestamps.length > 0 ? 
              Math.max(...processedTimestamps.map(ts => ts.end || ts.start)) : 0
            
            const durationDiff = Math.abs(actualDuration - estimatedDuration)
            const diffPercentage = estimatedDuration > 0 ? durationDiff / estimatedDuration : 1
            
            
            // [comment removed]
            if (diffPercentage > 0.2) {
              const sentences = processedTimestamps.map(ts => ts.text)
              const recalibratedTimestamps = estimateTimestamps(sentences, actualDuration)
              setProcessedTimestamps(recalibratedTimestamps)
            } else {
              // [comment removed]
              const scaleFactor = actualDuration / estimatedDuration
              const scaledTimestamps = processedTimestamps.map(ts => ({
                ...ts,
                start: ts.start * scaleFactor,
                end: ts.end ? ts.end * scaleFactor : actualDuration,
              }))
              
              // [comment removed]
              if (scaledTimestamps.length > 0) {
                scaledTimestamps[scaledTimestamps.length - 1].end = actualDuration
              }
              
              setProcessedTimestamps(scaledTimestamps)
            }
          })
        }
      } catch (error) {
        console.error("Error in handleLoadedMetadata:", error)
        setAudioLoadError("Failed to load audio metadata")
        setAudioLoadingState('error')
      }
    }

    const handleCanPlay = () => {
      setIsAudioLoaded(true)
    }

    const handleLoadError = (event: Event) => {
      console.error("Audio load error:", event)
      setAudioLoadError("Failed to load audio")
      setAudioLoadingState('error')
      setIsAudioLoaded(false)
    }

    const handleStalled = () => {
      // [comment removed]
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
  }, [text, sentenceTimestamps]) // [comment removed]

  // [comment removed]
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    const handleTimeUpdate = () => {
      try {
        if (audio.currentTime !== undefined && !isNaN(audio.currentTime)) {
          // [comment removed]
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
        setCurrentSentenceIndex(-1) // [comment removed]
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
  }, [throttledTimeUpdate]) // [comment removed]

  // [comment removed]
  const togglePlayPause = () => {
    const audio = audioRef.current
    if (!audio) {
      console.error("Audio element not available for play/pause control")
      return
    }

    // [comment removed]
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
        // [comment removed]
        if (!audioMetadataLoaded) {
          audio.load() // [comment removed]
          return
        }

        audio.play().catch((error) => {
          console.error("Audio play failed:", error)
          setIsPlaying(false) // [comment removed]
          
          // [comment removed]
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

  // [comment removed]
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

  // [comment removed]
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

  // [comment removed]
  const jumpToSentence = (index: number) => {
    try {
      // [comment removed]
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

      // [comment removed]
      if (isNaN(audio.duration) || audio.duration === 0) {
      }

      // [comment removed]
      if (typeof startTime === "number" && !isNaN(startTime) && startTime >= 0) {
        if (audio.duration && startTime <= audio.duration) {
          // [comment removed]
          audio.currentTime = startTime
        } else if (!audio.duration) {
          // [comment removed]
          audio.currentTime = startTime
        } else {
          audio.currentTime = Math.min(startTime, audio.duration)
        }

        // [comment removed]
        if (!isPlaying) {
          audio.play().catch((error) => {
            console.error("Failed to start playback after sentence jump:", error)
            setIsPlaying(false)
          })
        }
      } else {
        console.error(`Invalid start time: ${startTime}, defaulting to beginning of audio`)
        // [comment removed]
        audio.currentTime = 0

        // [comment removed]
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

  // [comment removed]
  const formatTime = (time: number) => {
    try {
      // [comment removed]
      if (typeof time !== "number" || isNaN(time) || time < 0) {
        return "0:00"
      }

      // [comment removed]
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
              Loading audio...
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
