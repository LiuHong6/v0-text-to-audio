import { NextResponse } from "next/server"
import { TextToSpeechClient } from "@google-cloud/text-to-speech"
import { createServerSupabaseClient } from "@/lib/supabase"

// 从环境变量中获取Google凭证
const getGoogleCredentials = () => {
  try {
    return JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || "{}")
  } catch (error) {
    console.error("Failed to parse Google credentials:", error)
    return {}
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const { text, voice = "cmn-CN-Standard-A", languageCode = "cmn-CN" } = await request.json()

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "文本内容不能为空" }, { status: 400 })
    }

    // 初始化Google TTS客户端
    const ttsClient = new TextToSpeechClient({
      credentials: getGoogleCredentials(),
    })

    // 调用Google TTS API
    const [response] = await ttsClient.synthesizeSpeech({
      input: { text },
      voice: {
        languageCode,
        name: voice,
      },
      audioConfig: { audioEncoding: "MP3" },
    })

    if (!response.audioContent) {
      throw new Error("Failed to generate audio content")
    }

    // 将音频数据上传到Supabase Storage
    const audioBuffer = Buffer.from(response.audioContent)
    const fileName = `speech_${Date.now()}.mp3`

    const { data, error } = await supabase.storage.from("audio-files").upload(fileName, audioBuffer, {
      contentType: "audio/mp3",
    })

    if (error) throw error

    // 获取公共URL
    const { data: urlData } = supabase.storage.from("audio-files").getPublicUrl(fileName)

    return NextResponse.json({
      audioUrl: urlData.publicUrl,
    })
  } catch (error) {
    console.error("Text-to-speech error:", error)
    return NextResponse.json(
      {
        error: "处理请求时出错",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
