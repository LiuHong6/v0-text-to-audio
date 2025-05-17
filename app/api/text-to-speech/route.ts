import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"

// 从环境变量中获取Google凭证
const getGoogleCredentials = () => {
  const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  if (!credsJson || credsJson === "{}") {
    console.error("GOOGLE_APPLICATION_CREDENTIALS_JSON is not set or is empty.")
    throw new Error("Google credentials are not configured properly.")
  }

  try {
    const parsedCreds = JSON.parse(credsJson)
    // 基本验证，检查必要字段
    if (!parsedCreds.project_id) {
      console.error("Parsed Google credentials seem invalid (missing project_id).")
      throw new Error("Parsed Google credentials seem invalid.")
    }
    console.log("Successfully parsed Google credentials for project:", parsedCreds.project_id)
    return parsedCreds
  } catch (error) {
    console.error("Failed to parse Google credentials JSON string:", error)
    // 打印一部分JSON以帮助调试（避免打印完整凭证）
    if (credsJson) {
      console.error(
        "Problematic GOOGLE_APPLICATION_CREDENTIALS_JSON (first 50 chars):",
        credsJson.substring(0, 50) + "...",
      )
    }
    throw new Error("Failed to parse Google credentials.")
  }
}

// 将文本分割成句子
function splitIntoSentences(text: string): string[] {
  // 使用正则表达式分割句子，考虑中英文标点
  const sentenceRegex = /([.!?。！？…]+[\s\n]*)/g
  const sentences = text.split(sentenceRegex).filter(Boolean)

  // 合并句子和标点
  const result = []
  for (let i = 0; i < sentences.length; i += 2) {
    if (i + 1 < sentences.length) {
      result.push(sentences[i] + sentences[i + 1])
    } else {
      result.push(sentences[i])
    }
  }

  // 处理可能的空句子和修剪空白
  return result.map((s) => s.trim()).filter((s) => s.length > 0)
}

// 为SSML标记添加句子标记
function addSentenceMarks(text: string): string {
  const sentences = splitIntoSentences(text)
  let ssml = "<speak>"

  sentences.forEach((sentence, index) => {
    ssml += `<mark name="sentence_${index}"/>${sentence} `
  })

  ssml += "</speak>"
  return ssml
}

export async function POST(request: Request) {
  try {
    // 解析请求
    let requestBody
    try {
      requestBody = await request.json()
    } catch (error) {
      return NextResponse.json(
        {
          error: "无效的请求格式",
          details: "请求必须是有效的JSON格式",
        },
        { status: 400 },
      )
    }

    const { text, voice = "cmn-CN-Standard-A", languageCode = "cmn-CN" } = requestBody

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "文本内容不能为空" }, { status: 400 })
    }

    // 获取Supabase客户端
    const supabase = createServerSupabaseClient()

    try {
      // 获取Google凭证
      const credentials = getGoogleCredentials()

      // 动态导入TextToSpeechClient以避免服务器端构建问题
      const { TextToSpeechClient } = await import("@google-cloud/text-to-speech")

      // 初始化Google TTS客户端
      const ttsClient = new TextToSpeechClient({ credentials })

      console.log(`Calling Google TTS API with voice: ${voice}, language: ${languageCode}`)

      // 准备SSML文本，添加句子标记
      const ssmlText = addSentenceMarks(text)

      // 调用Google TTS API，启用时间点功能
      const [response] = await ttsClient.synthesizeSpeech({
        input: { ssml: ssmlText },
        voice: {
          languageCode,
          name: voice,
        },
        audioConfig: {
          audioEncoding: "MP3",
          enableTimePointing: ["SSML_MARK"], // 启用SSML标记的时间点
        },
      })

      if (!response.audioContent) {
        throw new Error("Google TTS API did not return audio content")
      }

      // 提取时间点信息
      const timepoints = response.timepoints || []

      // 将时间点转换为句子时间戳
      const sentences = splitIntoSentences(text)
      const sentenceTimestamps = sentences.map((sentence, index) => {
        const markName = `sentence_${index}`
        const timepoint = timepoints.find((tp) => tp.markName === markName)

        return {
          text: sentence,
          start: timepoint ? Number(timepoint.timeSeconds) : 0,
          // 结束时间将在前端计算，因为我们只有开始时间
        }
      })

      // 将音频数据上传到Supabase Storage
      const audioBuffer = Buffer.from(response.audioContent)
      const fileName = `speech_${Date.now()}.mp3`

      const { data, error } = await supabase.storage.from("audio-files").upload(fileName, audioBuffer, {
        contentType: "audio/mp3",
      })

      if (error) {
        console.error("Error uploading to Supabase Storage:", error)
        throw new Error(`Failed to upload audio: ${error.message}`)
      }

      // 获取公共URL
      const { data: urlData } = supabase.storage.from("audio-files").getPublicUrl(fileName)

      return NextResponse.json({
        audioUrl: urlData.publicUrl,
        sentenceTimestamps,
        success: true,
      })
    } catch (googleError) {
      console.error("Google TTS error:", googleError)

      // 如果是Google API错误，尝试使用备用音频
      console.log("Falling back to sample audio due to Google TTS error")

      // 使用示例音频作为备用
      const fallbackAudioUrl = "https://audio-samples.github.io/samples/mp3/blizzard_biased/sample-1.mp3"

      // 记录到控制台但返回成功响应，使用备用音频
      return NextResponse.json({
        audioUrl: fallbackAudioUrl,
        success: true,
        fallback: true,
        message: "使用示例音频（Google TTS暂时不可用）",
      })
    }
  } catch (error) {
    // 确保所有错误都被捕获并返回有效的JSON
    console.error("Text-to-speech general error:", error)

    // 安全地提取错误消息
    let errorMessage = "处理请求时出错"
    let errorDetails = "未知错误"

    if (error instanceof Error) {
      errorMessage = error.message || errorMessage
      errorDetails = error.stack ? error.stack.split("\n")[0] : errorDetails
    } else if (typeof error === "string") {
      errorMessage = error
    } else if (error && typeof error === "object") {
      errorMessage = String(error)
    }

    // 返回格式化良好的错误响应
    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
