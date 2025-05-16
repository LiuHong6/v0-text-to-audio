"use client"

import { useEffect, useState } from "react"
import ProtectedRoute from "@/components/protected-route"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { createClientSupabaseClient } from "@/lib/supabase"
import { Trash2 } from "lucide-react"
import SyncAudioPlayer from "@/components/sync-audio-player"

type AudioHistoryItem = {
  id: string
  title: string | null
  text_content: string
  audio_url: string
  created_at: string
}

export default function HistoryPage() {
  const [history, setHistory] = useState<AudioHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const { toast } = useToast()
  const supabase = createClientSupabaseClient()

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data, error } = await supabase
          .from("audio_history")
          .select("*")
          .order("created_at", { ascending: false })

        if (error) throw error
        setHistory(data || [])
      } catch (error) {
        console.error("Error fetching history:", error)
        toast({
          title: "获取历史记录失败",
          description: "请稍后重试。",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchHistory()
  }, [supabase, toast])

  const deleteHistoryItem = async (id: string) => {
    try {
      const { error } = await supabase.from("audio_history").delete().eq("id", id)

      if (error) throw error

      setHistory(history.filter((item) => item.id !== id))
      toast({
        title: "删除成功",
        description: "历史记录已删除。",
      })
    } catch (error) {
      console.error("Error deleting history item:", error)
      toast({
        title: "删除失败",
        description: "请稍后重试。",
        variant: "destructive",
      })
    }
  }

  const toggleExpandItem = (id: string) => {
    setExpandedItem(expandedItem === id ? null : id)
  }

  const downloadAudio = (item: AudioHistoryItem) => {
    const link = document.createElement("a")
    link.href = item.audio_url
    link.download = `${item.title || "语音"}_${new Date(item.created_at).toISOString().slice(0, 10)}.mp3`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <ProtectedRoute>
      <div className="container py-10">
        <h1 className="text-3xl font-bold mb-6">历史记录</h1>

        {isLoading ? (
          <div className="grid gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-2">
                  <div className="h-5 bg-muted rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-muted rounded w-1/3"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-full mb-2"></div>
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : history.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <p className="text-muted-foreground mb-4">您还没有任何历史记录</p>
              <Button asChild>
                <a href="/">创建您的第一个语音</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {history.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="flex justify-between items-center">
                    <span className="truncate">{item.title || "未命名语音"}</span>
                    <Button variant="ghost" size="icon" onClick={() => deleteHistoryItem(item.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </CardTitle>
                  <div className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <p
                      className="text-sm line-clamp-2 cursor-pointer hover:text-primary"
                      onClick={() => toggleExpandItem(item.id)}
                    >
                      {item.text_content}
                    </p>
                  </div>

                  {expandedItem === item.id ? (
                    <SyncAudioPlayer
                      audioUrl={item.audio_url}
                      text={item.text_content}
                      onDownload={() => downloadAudio(item)}
                    />
                  ) : (
                    <div className="flex justify-between items-center">
                      <audio src={item.audio_url} controls className="w-full h-8" />
                      <Button variant="ghost" size="sm" className="ml-2" onClick={() => toggleExpandItem(item.id)}>
                        展开
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
