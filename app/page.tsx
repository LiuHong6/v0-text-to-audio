"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Volume2, Loader2 } from "lucide-react"

export default function TextToSpeechPage() {
  const [text, setText] = useState("")
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateSpeech = async () => {
    if (!text.trim()) {
      setError("请输入文本内容")
      return
    }

    try {
      setIsGenerating(true)
      setError(null)

      // 使用服务器端API生成语音
      const response = await fetch("/api/text-to-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      })

      if (!response.ok) {
        throw new Error("生成音频失败")
      }

      const data = await response.json()
      setAudioUrl(data.audioUrl)
    } catch (err) {
      setError("生成音频时出错，请重试")
      console.error(err)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="container max-w-3xl py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">文本转语音</CardTitle>
          <CardDescription>将您的文本转换为语音，粘贴文本并点击生成按钮</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="在此处粘贴您想要转换为语音的文本..."
            className="min-h-[200px] resize-y"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          {error && <div className="text-sm text-red-500">{error}</div>}

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
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h3 className="text-lg font-medium mb-2">您的音频已生成</h3>
              <audio controls className="w-full" src={audioUrl}>
                您的浏览器不支持音频播放
              </audio>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
