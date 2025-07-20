import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { splitIntoSentences } from "@/utils/text-processor"

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


// 为SSML标记添加句子标记
function addSentenceMarks(text: string): { ssml: string; sentences: string[] } {
  const sentences = splitIntoSentences(text)
  let ssml = "<speak>"

  sentences.forEach((sentence, index) => {
    // 在每个句子前添加标记
    ssml += `<mark name="sentence_${index}"/>${sentence} `
  })

  ssml += "</speak>"
  return { ssml, sentences }
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

    const { text, voice = "cmn-CN-Wavenet-A", languageCode = "cmn-CN" } = requestBody

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "文本内容不能为空" }, { status: 400 })
    }

    // 获取Supabase客户端
    const supabase = createServerSupabaseClient()

    try {
      // 获取Google凭证
      const credentials = getGoogleCredentials()

      // 动态导入TextToSpeechClient v1beta1以支持timepoints功能
      const { v1beta1 } = await import("@google-cloud/text-to-speech")

      // 初始化Google TTS客户端 (使用beta版本以支持timepoints)
      const ttsClient = new v1beta1.TextToSpeechClient({ credentials })

      console.log(`Calling Google TTS API with voice: ${voice}, language: ${languageCode}`)
      
      // 检查语音是否支持时间点功能
      if (voice.includes("Wavenet") || voice.includes("Neural2")) {
        console.log("✅ Using advanced voice that should support timepoints:", voice)
      } else {
        console.warn("⚠️ Using Standard voice - timepoints support may be limited:", voice)
      }

      // 准备SSML文本，添加句子标记
      const { ssml, sentences } = addSentenceMarks(text)

      console.log("Generated SSML:", ssml.substring(0, 200) + "...")
      console.log("Total SSML length:", ssml.length)
      console.log("Number of sentences:", sentences.length)
      console.log("Number of SSML marks:", (ssml.match(/<mark name=/g) || []).length)

      // 根据Google官方文档重新构建请求
      // enableTimePointing应该在顶层，不在audioConfig内
      const synthesizeRequest = {
        input: { ssml },
        voice: {
          languageCode,
          name: voice,
        },
        audioConfig: {
          audioEncoding: "MP3",
        },
        // timepoints功能配置在顶层
        enableTimePointing: ["SSML_MARK"],
      }
      
      console.log("TTS Request config:", JSON.stringify(synthesizeRequest, null, 2))
      
      // 尝试使用v1beta1的正确枚举值
      let response
      try {
        const requestWithCorrectEnum = {
          input: { ssml },
          voice: {
            languageCode,
            name: voice,
          },
          audioConfig: {
            audioEncoding: "MP3",
          },
          enableTimePointing: [1], // SSML_MARK的枚举值
        }
        
        console.log("Trying with enum value:", JSON.stringify(requestWithCorrectEnum, null, 2))
        
        const [enumResponse] = await ttsClient.synthesizeSpeech(requestWithCorrectEnum)
        
        if (!enumResponse.audioContent) {
          throw new Error("Google TTS API did not return audio content")
        }
        
        response = enumResponse
        
      } catch (enumError) {
        console.warn("Enum approach failed, trying string approach:", enumError)
        
        // 回退到字符串方式
        const [stringResponse] = await ttsClient.synthesizeSpeech(synthesizeRequest)
        
        if (!stringResponse.audioContent) {
          throw new Error("Google TTS API did not return audio content")
        }
        
        response = stringResponse
      }

      // 提取时间点信息
      const timepoints = response.timepoints || []
      console.log("从Google收到的时间点:", JSON.stringify(timepoints))
      console.log("Response keys:", Object.keys(response))
      
      // 详细分析响应结构
      if (timepoints.length === 0) {
        console.warn("⚠️ No timepoints in response. Checking response structure...")
        console.log("Response audioContent exists:", !!response.audioContent)
        console.log("Response has timing info:", !!response.timingInfo)
        console.log("Response all properties:", Object.getOwnPropertyNames(response))
      } else {
        console.log("✅ Successfully received", timepoints.length, "timepoints")
      }

      // 将时间点转换为句子时间戳，使用改进的验证逻辑
      let sentenceTimestamps
      
      if (timepoints.length > 0) {
        // 如果有时间点数据，使用精确的时间戳
        console.log("Using timepoints from Google TTS")
        sentenceTimestamps = sentences.map((sentence, index) => {
          const markName = `sentence_${index}`
          const timepoint = timepoints.find((tp) => tp.markName === markName)

          let startTime = 0 // 默认为0以防止NaN并处理缺失数据

          if (timepoint) {
            if (typeof timepoint.timeSeconds === "number" && !isNaN(timepoint.timeSeconds) && timepoint.timeSeconds >= 0) {
              startTime = timepoint.timeSeconds
            } else {
              // 如果找到时间点但timeSeconds不是有效数字，记录详细错误信息
              console.error(
                `Found timepoint for mark '${markName}' but timeSeconds is invalid:`,
                {
                  timeSeconds: timepoint.timeSeconds,
                  type: typeof timepoint.timeSeconds,
                  isNaN: isNaN(timepoint.timeSeconds as any),
                  isNegative: typeof timepoint.timeSeconds === "number" && timepoint.timeSeconds < 0
                }
              )
              // startTime保持为0
            }
          } else {
            // 如果在Google TTS响应中未找到SSML中指定的标记，记录警告
            console.warn(`Timepoint not found for mark '${markName}' in Google TTS response. Using default start time 0.`)
          }

          // 验证生成的时间戳对象
          const timestamp = {
            text: sentence.trim(),
            start: startTime,
          }

          // 基本验证
          if (!timestamp.text || timestamp.text.length === 0) {
            console.error(`Empty sentence text at index ${index}, this may cause sync issues`)
          }

          return timestamp
        })
      } else {
        // 如果没有时间点数据，生成估算的时间戳
        console.warn("No timepoints received from Google TTS, generating estimated timestamps")
        
        // 导入文本处理工具来生成估算时间戳
        const { estimateTimestamps } = await import("@/utils/text-processor")
        
        // 更精确的音频时长估算算法
        console.log("Analyzing text for duration estimation...")
        
        let estimatedDuration = 0
        const totalText = sentences.join('')
        
        // 分析文本组成
        const chineseChars = (totalText.match(/[\u4e00-\u9fa5]/g) || []).length
        const englishWords = (totalText.match(/[a-zA-Z]+/g) || []).length
        const numbers = (totalText.match(/\d+/g) || []).length
        const punctuation = (totalText.match(/[。！？；，、：]/g) || []).length
        const specialChars = totalText.length - chineseChars - englishWords - numbers - punctuation
        
        console.log(`Text analysis: ${chineseChars} Chinese chars, ${englishWords} English words, ${numbers} numbers, ${punctuation} punctuation, ${specialChars} special chars`)
        
        // 基于实际TTS测试的时间估算
        estimatedDuration += chineseChars * 0.28  // 中文字符 280ms
        estimatedDuration += englishWords * 0.45  // 英文单词 450ms  
        estimatedDuration += numbers * 0.35       // 数字 350ms
        estimatedDuration += punctuation * 0.4    // 标点停顿 400ms
        estimatedDuration += specialChars * 0.2   // 特殊字符 200ms
        
        // 句子间自然停顿
        estimatedDuration += (sentences.length - 1) * 0.4
        
        // WaveNet语音通常比Standard慢约15%
        if (voice.includes("Wavenet")) {
          estimatedDuration *= 1.15
        }
        
        // 合理的边界限制
        estimatedDuration = Math.max(3, Math.min(180, estimatedDuration))
        
        console.log(`Estimating duration: ${estimatedDuration}s for ${totalCharacters} characters`)
        
        sentenceTimestamps = estimateTimestamps(sentences, estimatedDuration).map(ts => ({
          text: ts.text,
          start: ts.start,
          // 不包含end时间，让前端计算
        }))
        
        console.log("Generated estimated timestamps:", sentenceTimestamps)
      }

      console.log("生成并发送给客户端的sentenceTimestamps:", JSON.stringify(sentenceTimestamps))

      // 验证生成的时间戳数据
      const validTimestamps = sentenceTimestamps.filter((ts, index) => {
        if (!ts.text || ts.text.trim().length === 0) {
          console.warn(`Empty sentence text at index ${index}`)
          return false
        }
        if (typeof ts.start !== "number" || isNaN(ts.start) || ts.start < 0) {
          console.warn(`Invalid start time at index ${index}:`, ts.start)
          return false
        }
        return true
      })

      if (validTimestamps.length !== sentenceTimestamps.length) {
        console.warn(`Filtered out ${sentenceTimestamps.length - validTimestamps.length} invalid timestamps`)
      }

      // 将音频数据上传到Supabase Storage
      let audioBuffer
      try {
        audioBuffer = Buffer.from(response.audioContent)
      } catch (error) {
        console.error("Error converting audio content to buffer:", error)
        throw new Error("Failed to process audio content")
      }

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

      if (!urlData || !urlData.publicUrl) {
        console.error("Failed to get public URL for uploaded audio")
        throw new Error("Failed to generate audio URL")
      }

      return NextResponse.json({
        audioUrl: urlData.publicUrl,
        sentenceTimestamps: validTimestamps,
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
