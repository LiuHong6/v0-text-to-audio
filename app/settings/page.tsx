"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { createClientSupabaseClient } from "@/lib/supabase"
import ProtectedRoute from "@/components/protected-route"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { voicesByLanguage, getDefaultVoice } from "@/lib/voice-options"

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("")
  const [preferredVoice, setPreferredVoice] = useState(getDefaultVoice().id)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClientSupabaseClient()

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return

      try {
        const { data, error } = await supabase.from("user_profiles").select("*").eq("id", user.id).single()

        if (error) throw error

        if (data) {
          setDisplayName(data.display_name || "")
          setPreferredVoice(data.preferred_voice || getDefaultVoice().id)
        }
      } catch (error) {
        console.error("Error fetching user profile:", error)
        toast({
          title: "Failed to fetch user profile",
          description: "Please try again later.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserProfile()
  }, [user, supabase, toast])

  const saveSettings = async () => {
    if (!user) return

    setIsSaving(true)

    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({
          display_name: displayName,
          preferred_voice: preferredVoice,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      if (error) throw error

      toast({
        title: "Settings Saved",
        description: "Your profile has been updated.",
      })
    } catch (error) {
      console.error("Error saving settings:", error)
      toast({
        title: "Failed to save settings",
        description: "Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ProtectedRoute>
      <div className="container max-w-3xl py-10">
        <h1 className="text-3xl font-bold mb-6">Account Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Update your profile and preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                <div className="h-10 bg-muted animate-pulse rounded"></div>
                <div className="h-10 bg-muted animate-pulse rounded"></div>
                <div className="h-10 bg-muted animate-pulse rounded"></div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={user?.email || ""} disabled />
                  <p className="text-sm text-muted-foreground">Your email address cannot be changed</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    placeholder="Enter your display name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preferredVoice">Default Voice</Label>
                  <Select value={preferredVoice} onValueChange={setPreferredVoice}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select default voice" />
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
                  <p className="text-sm text-muted-foreground">This voice will be used as your default voice option</p>
                </div>

                <Button onClick={saveSettings} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Settings"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  )
}
