"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Volume2, Loader2, AlertCircle } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { createClientSupabaseClient } from "@/lib/supabase"
import { useToast } from "@/components/ui/use-toast"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { allVoices, voicesByLanguage, getDefaultVoice } from "@/lib/voice-options"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import SyncAudioPlayer from "@/components/sync-audio-player"

interface SentenceTimestamp {
  text: string
  start: number
  end?: number
}

export default function TextToSpeechPage() {
  const [text, setText] = useState("")
  const [title, setTitle] = useState("")
  const [selectedVoice, setSelectedVoice] = useState(getDefaultVoice().id)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [sentenceTimestamps, setSentenceTimestamps] = useState<SentenceTimestamp[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFallbackAudio, setIsFallbackAudio] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClientSupabaseClient()

  const generateSpeech = async () => {
    if (!text.trim()) {
      setError("请输入文本内容")
      return
    }

    try {
      setIsGenerating(true)
      setError(null)
      setIsFallbackAudio(false)
      setAudioUrl(null)
      setSentenceTimestamps([])

      // 找到选中的语音选项
      const voice = allVoices.find((v) => v.id === selectedVoice) || getDefaultVoice()

      // 使用服务器端API生成语音
      const response = await fetch("/api/text-to-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          voice: voice.id,
          languageCode: voice.languageCode,
        }),
      })

      // 检查响应状态
      if (!response.ok) {
        let errorMessage = "生成音频失败"
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.details || errorMessage
        } catch (e) {
          // 如果响应不是JSON格式，使用状态文本
          errorMessage = `服务器错误: ${response.status} ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      // 解析JSON响应
      let data
      try {
        data = await response.json()
      } catch (e) {
        throw new Error("服务器返回了无效的JSON数据")
      }

      if (!data.audioUrl) {
        throw new Error("服务器未返回音频URL")
      }

      setAudioUrl(data.audioUrl)

      // 设置句子时间戳（如果有）
      if (data.sentenceTimestamps && Array.isArray(data.sentenceTimestamps)) {
        setSentenceTimestamps(data.sentenceTimestamps)
      }

      // 检查是否使用了备用音频
      if (data.fallback) {
        setIsFallbackAudio(true)
        toast({
          title: "使用示例音频",
          description: data.message || "Google TTS暂时不可用，使用示例音频代替",
          variant: "warning",
        })
      }

      // 如果用户已登录，保存到历史记录
      if (user && !data.savedToHistory) {
        const { error: saveError } = await supabase.from("audio_history").insert({
          user_id: user.id,
          text_content: text,
          audio_url: data.audioUrl,
          title: title || `${voice.name} 生成的音频`,
          // 也可以考虑保存时间戳数据
          // timestamps: JSON.stringify(data.sentenceTimestamps || [])
        })

        if (saveError) {
          console.error("Error saving to history:", saveError)
          toast({
            title: "保存历史记录失败",
            description: "您的音频已生成，但无法保存到历史记录。",
            variant: "destructive",
          })
        } else {
          toast({
            title: "音频已生成",
            description: "已保存到您的历史记录。",
          })
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成音频时出错，请重试")
      console.error(err)
    } finally {
      setIsGenerating(false)
    }
  }

  // 下载音频文件
  const downloadAudio = () => {
    if (!audioUrl) return

    const link = document.createElement("a")
    link.href = audioUrl
    link.download = `${title || "语音"}_${new Date().toISOString().slice(0, 10)}.mp3`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="container max-w-3xl py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">文本转语音</CardTitle>
          <CardDescription>将您的文本转换为语音，粘贴文本并点击生成按钮</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user && (
            <div className="space-y-2">
              <Label htmlFor="title">标题（可选）</Label>
              <Input
                id="title"
                placeholder="为您的音频添加标题"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="voice">语音选项</Label>
            <Select value={selectedVoice} onValueChange={setSelectedVoice}>
              <SelectTrigger>
                <SelectValue placeholder="选择语音" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(voicesByLanguage).map(([language, voices]) => (
                  <SelectGroup key={language}>
                    <SelectLabel>{language}</SelectLabel>
                    {voices.map((voice) => (
                      <SelectItem key={voice.id} value={voice.id}>
                        {voice.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="text">文本内容</Label>
            <Textarea
              id="text"
              placeholder="在此处粘贴您想要转换为语音的文本..."
              className="min-h-[200px] resize-y"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>错误</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end">
            <Button onClick={generateSpeech} disabled={isGenerating || !text.trim()} className="w-full sm:w-auto">
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在生成...
                </>
              ) : (
                <>
                  <Volume2 className="mr-2 h-4 w-4" />
                  生成音频
                </>
              )}
            </Button>
          </div>

          {audioUrl && (
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2">您的音频已生成</h3>

              {isFallbackAudio && (
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>使用示例音频</AlertTitle>
                  <AlertDescription>Google TTS服务暂时不可用，当前使用示例音频代替。请稍后再试。</AlertDescription>
                </Alert>
              )}

              {/* 传递API返回的时间戳到同步播放器 */}
              <SyncAudioPlayer
                audioUrl={audioUrl}
                text={text}
                sentenceTimestamps={sentenceTimestamps}
                onDownload={downloadAudio}
              />

              {!user && (
                <div className="mt-4 p-3 bg-primary/10 rounded border border-primary/20 text-sm">
                  <p>登录或注册账户，即可保存您的音频历史记录！</p>
                  <div className="flex gap-2 mt-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href="/login">登录</a>
                    </Button>
                    <Button size="sm" asChild>
                      <a href="/register">注册</a>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
