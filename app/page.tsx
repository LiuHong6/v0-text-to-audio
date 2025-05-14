"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Volume2, Loader2 } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { createClientSupabaseClient } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function TextToSpeechPage() {
  const [text, setText] = useState("")
  const [title, setTitle] = useState("")
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

      // 如果用户已登录，保存到历史记录
      if (user) {
        const { error: saveError } = await supabase.from("audio_history").insert({
          user_id: user.id,
          text_content: text,
          audio_url: data.audioUrl,
          title: title || null,
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
            <Label htmlFor="text">文本内容</Label>
            <Textarea
              id="text"
              placeholder="在此处粘贴您想要转换为语音的文本..."
              className="min-h-[200px] resize-y"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

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
