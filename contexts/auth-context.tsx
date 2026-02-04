"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState, useMemo } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { createClientSupabaseClient, isSupabaseConfigured } from "@/lib/supabase"
import { useRouter } from "next/navigation"

type AuthContextType = {
  user: User | null
  session: Session | null
  isLoading: boolean
  isConfigured: boolean
  signUp: (email: string, password: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = useMemo(() => createClientSupabaseClient(), [])
  const configured = isSupabaseConfigured()

  useEffect(() => {
    // 如果 Supabase 未配置，直接设置加载完成
    if (!supabase) {
      setIsLoading(false)
      return
    }

    const getSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()
      if (error) {
        console.error("Error getting session:", error)
      }
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
    }

    getSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
      router.refresh()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router, supabase])

  const signUp = async (email: string, password: string) => {
    if (!supabase) {
      throw new Error("Supabase is not configured")
    }
    setIsLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })
    if (error) {
      throw error
    }
    setIsLoading(false)
  }

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      throw new Error("Supabase is not configured")
    }
    setIsLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) {
      throw error
    }
    setIsLoading(false)
    router.push("/dashboard")
  }

  const signOut = async () => {
    if (!supabase) {
      throw new Error("Supabase is not configured")
    }
    setIsLoading(true)
    const { error } = await supabase.auth.signOut()
    if (error) {
      throw error
    }
    setIsLoading(false)
    router.push("/")
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isConfigured: configured,
        signUp,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
