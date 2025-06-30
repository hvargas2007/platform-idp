import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { 
  User,
  Bell,
  Shield,
  Code,
  Palette,
  HelpCircle,
  Save
} from "lucide-react"

export default async function SettingsPage() {
  const session = await auth()

  const settingSections = [
    {
      title: "Profile",
      icon: User,
      description: "Manage your personal information and preferences"
    },
    {
      title: "Notifications",
      icon: Bell,
      description: "Configure how and when you receive notifications"
    },
    {
      title: "Security",
      icon: Shield,
      description: "Update your password and security settings"
    },
    {
      title: "API & Integrations",
      icon: Code,
      description: "Manage API keys and third-party integrations"
    },
    {
      title: "Appearance",
      icon: Palette,
      description: "Customize the look and feel of your dashboard"
    },
    {
      title: "Help & Support",
      icon: HelpCircle,
      description: "Get help and contact support"
    }
  ]

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Manage your account settings and preferences</p>
      </div>

      {/* User Info Card */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
        <div className="flex items-center gap-4">
          {session!.user?.image ? (
            <img
              src={session!.user.image}
              alt="Profile"
              className="h-16 w-16 rounded-full ring-4 ring-gray-200"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-gradient-primary flex items-center justify-center">
              <User className="h-8 w-8 text-white" />
            </div>
          )}
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {session!.user?.name || "User"}
            </h2>
            <p className="text-sm text-gray-600">{session!.user?.email}</p>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 mt-2 capitalize">
              {session!.user?.role?.toLowerCase() || "user"}
            </span>
          </div>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="grid gap-6 md:grid-cols-2">
        {settingSections.map((section) => (
          <div
            key={section.title}
            className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-all duration-200 cursor-pointer card-hover"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gray-100 rounded-xl">
                <section.icon className="h-6 w-6 text-gray-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">{section.title}</h3>
                <p className="text-sm text-gray-600">{section.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium text-gray-900">Export Data</p>
              <p className="text-sm text-gray-600">Download all your projects and templates data</p>
            </div>
            <Button variant="outline" size="sm">
              Export
            </Button>
          </div>
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium text-gray-900">Clear Cache</p>
              <p className="text-sm text-gray-600">Clear temporary data and refresh your workspace</p>
            </div>
            <Button variant="outline" size="sm">
              Clear
            </Button>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-gray-900">Delete Account</p>
              <p className="text-sm text-gray-600">Permanently delete your account and all data</p>
            </div>
            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}