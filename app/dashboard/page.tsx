"use client"

import ProtectedRoute from "@/components/protected-route"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import Link from "next/link"
import { History, Settings, Volume2 } from "lucide-react"

export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <ProtectedRoute>
      <div className="container py-10">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Welcome Back</CardTitle>
              <CardDescription>{user?.email}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">You can manage your account and view your history here.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Text to Speech</CardTitle>
              <CardDescription>Convert text to speech</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Create new speech conversion</p>
              <Button asChild>
                <Link href="/">
                  <Volume2 className="mr-2 h-4 w-4" />
                  Start Converting
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>History</CardTitle>
              <CardDescription>View your conversion history</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">View and manage your history</p>
              <Button variant="outline" asChild>
                <Link href="/history">
                  <History className="mr-2 h-4 w-4" />
                  View History
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>Manage your profile</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Update your profile and preferences</p>
              <Button variant="outline" asChild>
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  )
}
