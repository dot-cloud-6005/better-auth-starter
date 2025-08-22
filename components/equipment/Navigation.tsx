'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { 
  Menu, 
  X, 
  Home, 
  BarChart3,  
  Package,
  Calendar,
  Truck,
  LogOut
} from 'lucide-react'

import { authClient } from "@/lib/auth-client"


const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Equipment', href: '/equipment', icon: Package },
  { name: 'Plant', href: '/plant', icon: Truck },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Inspections', href: '/inspections', icon: Calendar },
]

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  // Using Better Auth for session management

  const toggleNavigation = () => {
    setIsOpen(!isOpen)
  }

  const closeNavigation = () => {
    setIsOpen(false)
  }

  const handleLogout = async () => {
    try {
      await authClient.signOut();
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Unexpected error during logout:', error);
    }
  }

  return (
    <>
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-800/95 backdrop-blur-sm border-b border-slate-600">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <Package className="h-8 w-8 text-blue-400" />
              <div>
                <h1 className="text-xl font-bold text-white">DOT Equipment</h1>
                <p className="text-xs text-slate-300">Register System</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-1">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                )
              })}
              
              {/* Desktop Logout Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="flex items-center space-x-2 px-3 py-2 text-slate-300 hover:bg-red-600 hover:text-white transition-colors ml-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>
            </div>

            {/* Mobile menu button */}
            <div className="lg:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleNavigation}
                className="text-slate-300 hover:text-white hover:bg-slate-400"
              >
                {isOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isOpen && (
          <div className="lg:hidden border-t border-slate-600 bg-slate-800/95 backdrop-blur-sm">
            <div className="container mx-auto px-4 py-4">
              <div className="flex flex-col space-y-2">
                {navigation.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={closeNavigation}
                      className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.name}</span>
                    </Link>
                  )
                })}
                
                {/* Mobile Logout Button */}
                <button
                  onClick={() => {
                    handleLogout()
                    closeNavigation()
                  }}
                  className="flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors text-slate-300 hover:bg-red-600 hover:text-white border-t border-slate-600 mt-2 pt-4"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={closeNavigation}
        />
      )}
    </>
  )
}