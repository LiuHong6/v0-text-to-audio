import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { splitIntoSentences } from "@/utils/text-processor"

// [comment removed]
const getGoogleCredentials = () => {
  const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  if (!credsJson || credsJson === "{}") {
    console.error("GOOGLE_APPLICATION_CREDENTIALS_JSON is not set or is empty.")
    throw new Error("Google credentials are not configured properly.")
  }

  try {
    const parsedCreds = JSON.parse(credsJson)
    // [comment removed]
    if (!parsedCreds.project_id) {
      console.error("Parsed Google credentials seem invalid (missing project_id).")
      throw new Error("Parsed Google credentials seem invalid.")
    }
    console.log("Successfully parsed Google credentials for project:", parsedCreds.project_id)
    return parsedCreds
  } catch (error) {
    console.error("Failed to parse Google credentials JSON string:", error)
    // [comment removed]
    if (credsJson) {
      console.error(
        "Problematic GOOGLE_APPLICATION_CREDENTIALS_JSON (first 50 chars):",
        credsJson.substring(0, 50) + "...",
      )
    }
    throw new Error("Failed to parse Google credentials.")
  }
}


// [comment removed]
function addSentenceMarks(text: string): { ssml: string; sentences: string[] } {
  const sentences = splitIntoSentences(text)
  let ssml = "<speak>"

  sentences.forEach((sentence, index) => {
    // [comment removed]
    ssml += `<mark name="sentence_${index}"/>${sentence} `
  })

  ssml += "</speak>"
  return { ssml, sentences }
}

export async function POST(request: Request) {
  try {
    // [comment removed]
    let requestBody
    try {
      requestBody = await request.json()
    } catch (error) {
      return NextResponse.json(
        {
          error: "Invalid request format",
          details: "Request must be valid JSON format",
        },
        { status: 400 },
      )
    }

    const { text, voice = "cmn-CN-Wavenet-A", languageCode = "cmn-CN" } = requestBody

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text content cannot be empty" }, { status: 400 })
    }

    // [comment removed]
    const supabase = createServerSupabaseClient()

    try {
      // [comment removed]
      const credentials = getGoogleCredentials()

      // [comment removed]
      const { v1beta1 } = await import("@google-cloud/text-to-speech")

      // [comment removed]
      const ttsClient = new v1beta1.TextToSpeechClient({ credentials })

      console.log(`Calling Google TTS API with voice: ${voice}, language: ${languageCode}`)
      
      // [comment removed]
      if (voice.includes("Wavenet") || voice.includes("Neural2")) {
        console.log("✅ Using advanced voice that should support timepoints:", voice)
      } else {
        console.warn("⚠️ Using Standard voice - timepoints support may be limited:", voice)
      }

      // [comment removed]
      const { ssml, sentences } = addSentenceMarks(text)

      console.log("Generated SSML:", ssml.substring(0, 200) + "...")
      console.log("Total SSML length:", ssml.length)
      console.log("Number of sentences:", sentences.length)
      console.log("Number of SSML marks:", (ssml.match(/<mark name=/g) || []).length)

      // [comment removed]
      // enableTimePointing should be at top level, not in audioConfig
      const synthesizeRequest = {
        input: { ssml },
        voice: {
          languageCode,
          name: voice,
        },
        audioConfig: {
          audioEncoding: "MP3",
        },
        // timepoints functionality configured at top level
        enableTimePointing: ["SSML_MARK"],
      }
      
      console.log("TTS Request config:", JSON.stringify(synthesizeRequest, null, 2))
      
      // [comment removed]
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
          enableTimePointing: [1], // SSML_MARK enum value
        }
        
        console.log("Trying with enum value:", JSON.stringify(requestWithCorrectEnum, null, 2))
        
        const [enumResponse] = await ttsClient.synthesizeSpeech(requestWithCorrectEnum)
        
        if (!enumResponse.audioContent) {
          throw new Error("Google TTS API did not return audio content")
        }
        
        response = enumResponse
        
      } catch (enumError) {
        console.warn("Enum approach failed, trying string approach:", enumError)
        
        // [comment removed]
        const [stringResponse] = await ttsClient.synthesizeSpeech(synthesizeRequest)
        
        if (!stringResponse.audioContent) {
          throw new Error("Google TTS API did not return audio content")
        }
        
        response = stringResponse
      }

      // [comment removed]
      const timepoints = response.timepoints || []
      console.log("Timepoints received from Google:", JSON.stringify(timepoints))
      console.log("Response keys:", Object.keys(response))
      
      // [comment removed]
      if (timepoints.length === 0) {
        console.warn("⚠️ No timepoints in response. Checking response structure...")
        console.log("Response audioContent exists:", !!response.audioContent)
        console.log("Response has timing info:", !!response.timingInfo)
        console.log("Response all properties:", Object.getOwnPropertyNames(response))
      } else {
        console.log("✅ Successfully received", timepoints.length, "timepoints")
      }

      // [comment removed]
      let sentenceTimestamps
      
      if (timepoints.length > 0) {
        // [comment removed]
        console.log("Using timepoints from Google TTS")
        sentenceTimestamps = sentences.map((sentence, index) => {
          const markName = `sentence_${index}`
          const timepoint = timepoints.find((tp) => tp.markName === markName)

          let startTime = 0 // [comment removed]

          if (timepoint) {
            if (typeof timepoint.timeSeconds === "number" && !isNaN(timepoint.timeSeconds) && timepoint.timeSeconds >= 0) {
              startTime = timepoint.timeSeconds
            } else {
              // [comment removed]
              console.error(
                `Found timepoint for mark '${markName}' but timeSeconds is invalid:`,
                {
                  timeSeconds: timepoint.timeSeconds,
                  type: typeof timepoint.timeSeconds,
                  isNaN: isNaN(timepoint.timeSeconds as any),
                  isNegative: typeof timepoint.timeSeconds === "number" && timepoint.timeSeconds < 0
                }
              )
              // startTime remains 0
            }
          } else {
            // [comment removed]
            console.warn(`Timepoint not found for mark '${markName}' in Google TTS response. Using default start time 0.`)
          }

          // [comment removed]
          const timestamp = {
            text: sentence.trim(),
            start: startTime,
          }

          // [comment removed]
          if (!timestamp.text || timestamp.text.length === 0) {
            console.error(`Empty sentence text at index ${index}, this may cause sync issues`)
          }

          return timestamp
        })
      } else {
        // [comment removed]
        console.warn("No timepoints received from Google TTS, generating estimated timestamps")
        
        // [comment removed]
        const { estimateTimestamps } = await import("@/utils/text-processor")
        
        // [comment removed]
        console.log("Analyzing text for duration estimation...")
        
        let estimatedDuration = 0
        const totalText = sentences.join('')
        
        // [comment removed]
        const isChineseLanguage = languageCode.startsWith("cmn") || languageCode.startsWith("zh")
        const isEnglishLanguage = languageCode.startsWith("en")
        const isFrenchLanguage = languageCode.startsWith("fr")
        const isJapaneseLanguage = languageCode.startsWith("ja")
        const isPortugueseLanguage = languageCode.startsWith("pt")
        
        console.log(`Language detected: ${languageCode}, isChineseLanguage: ${isChineseLanguage}`)
        
        if (isChineseLanguage) {
          // [comment removed]
          const chineseChars = (totalText.match(/[\u4e00-\u9fa5]/g) || []).length
          const englishWords = (totalText.match(/[a-zA-Z]+/g) || []).length
          const numbers = (totalText.match(/\d+/g) || []).length
          const punctuation = (totalText.match(/[。！？；，、：]/g) || []).length
          const specialChars = totalText.length - chineseChars - englishWords - numbers - punctuation
          
          estimatedDuration += chineseChars * 0.28  // [comment removed]
          estimatedDuration += englishWords * 0.45  // [comment removed]
          estimatedDuration += numbers * 0.35       // [comment removed]
          estimatedDuration += punctuation * 0.4    // [comment removed]
          estimatedDuration += specialChars * 0.2   // [comment removed]
          
          console.log(`Chinese analysis: ${chineseChars} chars, ${englishWords} EN words, ${punctuation} punctuation`)
          
        } else if (isEnglishLanguage) {
          // [comment removed]
          const words = totalText.split(/\s+/).filter(word => word.length > 0).length
          const sentences_count = (totalText.match(/[.!?]+/g) || []).length
          
          estimatedDuration += words * 0.35        // [comment removed]
          estimatedDuration += sentences_count * 0.5 // [comment removed]
          
          console.log(`English analysis: ${words} words, ${sentences_count} sentences`)
          
        } else if (isFrenchLanguage) {
          // [comment removed]
          const words = totalText.split(/\s+/).filter(word => word.length > 0).length
          const sentences_count = (totalText.match(/[.!?]+/g) || []).length
          
          estimatedDuration += words * 0.38        // [comment removed]
          estimatedDuration += sentences_count * 0.5 // [comment removed]
          
          console.log(`French analysis: ${words} words, ${sentences_count} sentences`)
          
        } else if (isJapaneseLanguage) {
          // [comment removed]
          const japaneseChars = (totalText.match(/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g) || []).length
          const englishWords = (totalText.match(/[a-zA-Z]+/g) || []).length
          const punctuation = (totalText.match(/[。！？；，、]/g) || []).length
          
          estimatedDuration += japaneseChars * 0.32 // [comment removed]
          estimatedDuration += englishWords * 0.45  // [comment removed]
          estimatedDuration += punctuation * 0.4    // [comment removed]
          
          console.log(`Japanese analysis: ${japaneseChars} chars, ${englishWords} EN words, ${punctuation} punctuation`)
          
        } else if (isPortugueseLanguage) {
          // [comment removed]
          const words = totalText.split(/\s+/).filter(word => word.length > 0).length
          const sentences_count = (totalText.match(/[.!?]+/g) || []).length
          
          estimatedDuration += words * 0.40        // [comment removed]
          estimatedDuration += sentences_count * 0.5 // [comment removed]
          
          console.log(`Portuguese analysis: ${words} words, ${sentences_count} sentences`)
          
        } else {
          // [comment removed]
          const words = totalText.split(/\s+/).filter(word => word.length > 0).length
          estimatedDuration += words * 0.35
          console.log(`Default analysis: ${words} words`)
        }
        
        // [comment removed]
        estimatedDuration += (sentences.length - 1) * 0.4
        
        // WaveNet voices are usually ~15% slower than Standard
        if (voice.includes("Wavenet")) {
          estimatedDuration *= 1.15
        }
        
        // [comment removed]
        estimatedDuration = Math.max(3, Math.min(180, estimatedDuration))
        
        console.log(`Estimating duration: ${estimatedDuration}s for ${totalText.length} characters`)
        
        sentenceTimestamps = estimateTimestamps(sentences, estimatedDuration).map(ts => ({
          text: ts.text,
          start: ts.start,
          // [comment removed]
        }))
        
        console.log("Generated estimated timestamps:", sentenceTimestamps)
      }

      console.log("Generated sentenceTimestamps sent to client:", JSON.stringify(sentenceTimestamps))

      // [comment removed]
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

      // [comment removed]
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

      // [comment removed]
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

      // [comment removed]
      console.log("Falling back to sample audio due to Google TTS error")

      // [comment removed]
      const fallbackAudioUrl = "https://audio-samples.github.io/samples/mp3/blizzard_biased/sample-1.mp3"

      // [comment removed]
      return NextResponse.json({
        audioUrl: fallbackAudioUrl,
        success: true,
        fallback: true,
        message: "Using sample audio (Google TTS temporarily unavailable)",
      })
    }
  } catch (error) {
    // [comment removed]
    console.error("Text-to-speech general error:", error)

    // [comment removed]
    let errorMessage = "Error processing request"
    let errorDetails = "Unknown error"

    if (error instanceof Error) {
      errorMessage = error.message || errorMessage
      errorDetails = error.stack ? error.stack.split("\n")[0] : errorDetails
    } else if (typeof error === "string") {
      errorMessage = error
    } else if (error && typeof error === "object") {
      errorMessage = String(error)
    }

    // [comment removed]
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
