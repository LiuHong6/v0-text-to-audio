import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// 创建服务端Supabase客户端
export const createServerSupabaseClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.warn("Missing Supabase server environment variables")
    return null
  }

  return createClient(supabaseUrl, supabaseKey)
}

// 创建客户端Supabase客户端（单例模式）
let clientSupabaseClient: SupabaseClient | null = null

export const createClientSupabaseClient = (): SupabaseClient | null => {
  if (clientSupabaseClient) return clientSupabaseClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.warn("Missing Supabase client environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)")
    return null
  }

  clientSupabaseClient = createClient(supabaseUrl, supabaseKey)
  return clientSupabaseClient
}

// 检查 Supabase 是否已配置
export const isSupabaseConfigured = (): boolean => {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}
