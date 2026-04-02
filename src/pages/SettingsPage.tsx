import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import { Settings, User, Shield, Bell, Database } from 'lucide-react'

export function SettingsPage() {
  const { user, isDemoMode } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      {isDemoMode && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-3 p-4">
            <Database className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Demo Mode Active</p>
              <p className="text-xs text-muted-foreground">
                You're viewing sample data. Connect your Supabase project to use real data.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" /> Profile
            </CardTitle>
            <CardDescription>Your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Full Name</label>
              <Input defaultValue={isDemoMode ? 'Demo User' : ''} placeholder="Your name" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input defaultValue={isDemoMode ? 'demo@financehub.app' : user?.email || ''} disabled />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Currency</label>
              <Input defaultValue="USD" placeholder="USD" />
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" /> Supabase Connection
            </CardTitle>
            <CardDescription>Connect to your Supabase project</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Project URL</label>
              <Input placeholder="https://your-project.supabase.co" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Anon Key</label>
              <Input type="password" placeholder="your-anon-key" />
            </div>
            <Button variant="outline">Test Connection</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" /> Notifications
            </CardTitle>
            <CardDescription>Manage your alert preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg p-3 hover:bg-secondary/50">
              <div>
                <p className="text-sm font-medium">Bill Reminders</p>
                <p className="text-xs text-muted-foreground">Get notified before bills are due</p>
              </div>
              <div className="h-6 w-11 rounded-full bg-primary p-0.5 cursor-pointer">
                <div className="h-5 w-5 rounded-full bg-white translate-x-5 transition-transform" />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg p-3 hover:bg-secondary/50">
              <div>
                <p className="text-sm font-medium">Budget Alerts</p>
                <p className="text-xs text-muted-foreground">Notify when approaching budget limits</p>
              </div>
              <div className="h-6 w-11 rounded-full bg-primary p-0.5 cursor-pointer">
                <div className="h-5 w-5 rounded-full bg-white translate-x-5 transition-transform" />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg p-3 hover:bg-secondary/50">
              <div>
                <p className="text-sm font-medium">Weekly Summary</p>
                <p className="text-xs text-muted-foreground">Receive a weekly financial digest</p>
              </div>
              <div className="h-6 w-11 rounded-full bg-muted p-0.5 cursor-pointer">
                <div className="h-5 w-5 rounded-full bg-muted-foreground/50 transition-transform" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" /> Security
            </CardTitle>
            <CardDescription>Protect your account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full">Change Password</Button>
            <Button variant="outline" className="w-full">Enable Two-Factor Auth</Button>
            <Button variant="destructive" className="w-full">Delete Account</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
