'use client';

import { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { 
  Menu, X, Home, User, HouseWifi, Router, Logs, 
  FilePlus2, LogOut, RefreshCw,
  Settings, ChevronDown, Bell, HelpCircle
} from 'lucide-react'; 
import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { syncWinsSites } from '@/app/actions/syncSites';

const MySwal = withReactContent(Swal);

const links = [
  { name: 'Dashboard', href: '/dashboard', icon: <Home size={18} /> },
  { name: 'Sites', href: '/sites', icon: <HouseWifi size={18} /> },
  { name: 'Clients', href: '/site-clients', icon: <User size={18} /> },
  { name: 'AP Devices', href: '/site-aps', icon: <Router size={18} /> },
  { name: 'Generate', href: '/xtspa', icon: <FilePlus2 size={18} /> },
  { name: 'Manual Data', href: '/manual-data', icon: <FilePlus2 size={18} />, role: 'developer' },
  { name: 'Events', href: '/events', icon: <Logs size={18} />, role: 'developer' },
];

// Text Type Animation Component
const TypewriterText = ({ text, speed = 100, className = "" }) => {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, speed);

      return () => clearTimeout(timer);
    }
  }, [currentIndex, text, speed]);

  return (
    <span className={className}>
      {displayText}
      <span className="animate-pulse">|</span>
    </span>
  );
};

// CSS Loader for Syncing Modal
const SyncingLoader = () => {
  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-6">
      {/* Main Spinner */}
      <div className="relative">
        <div className="w-20 h-20 border-4 border-gray-700 rounded-full"></div>
        <div className="absolute top-0 left-0 w-20 h-20 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
        <div className="absolute top-2 left-2 w-16 h-16 border-4 border-purple-500 rounded-full border-b-transparent animate-spin animation-delay-150"></div>
        <div className="absolute top-4 left-4 w-12 h-12 border-4 border-cyan-500 rounded-full border-r-transparent animate-spin animation-delay-300"></div>
      </div>
      
      {/* Progress Text */}
      <div className="text-center space-y-2">
        <h3 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Syncing Sites
        </h3>
        <p className="text-gray-300 text-sm">Fetching latest data from APIs...</p>
        
        {/* Progress Dots */}
        <div className="flex justify-center space-x-2 mt-4">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse animation-delay-200"></div>
          <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse animation-delay-400"></div>
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse animation-delay-600"></div>
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse animation-delay-800"></div>
        </div>
      </div>
      
      {/* Glowing Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-cyan-500/10 rounded-xl blur-xl"></div>
    </div>
  );
};

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const profileRef = useRef(null);

  const sidebarClass =
    'backdrop-blur-md bg-white/10 dark:bg-gray-800/20 border-r border-white/20 text-white';

  const headerClass =
    'backdrop-blur-md bg-white/10 dark:bg-gray-800/20 border-b border-white/20 shadow';

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSyncClick = async () => {
    if (syncing) return;
    
    // Close profile dropdown when sync starts
    setProfileOpen(false);
    
    const result = await MySwal.fire({
      title: 'Sync Sites',
      text: "This will fetch the latest sites from Omada and Ruijie APIs and update the database. Continue?",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, sync now',
      cancelButtonText: 'Cancel',
      background: '#1f2937',
      color: 'white',
      customClass: {
        popup: 'backdrop-blur-sm bg-gray-900/95 border border-white/10',
        title: 'text-white',
        htmlContainer: 'text-gray-300'
      }
    });

    if (result.isConfirmed) {
      setSyncing(true);
      
      // Show custom syncing modal with CSS loader
      const syncingModal = MySwal.fire({
        title: '',
        html: <SyncingLoader />,
        showConfirmButton: false,
        allowOutsideClick: false,
        showCloseButton: false,
        backdrop: 'rgba(0,0,0,0.8)',
        customClass: {
          popup: 'backdrop-blur-md bg-gray-900/95 border border-white/10 shadow-2xl',
          container: 'z-50'
        },
        width: '500px',
        padding: '0'
      });

      try {
        // Call server action
        const result = await syncWinsSites();
        
        // Close the syncing modal
        await syncingModal.close();
        
        if (result.success) {
          await MySwal.fire({
            title: 'Sync Complete!',
            text: result.message,
            icon: 'success',
            confirmButtonColor: '#10b981',
            background: '#1f2937',
            color: 'white',
            customClass: {
              popup: 'backdrop-blur-sm bg-gray-900/95 border border-white/10',
              title: 'text-white'
            }
          });
          
          // Always refresh the current page after successful sync
          router.refresh();
          
          // Show a toast notification about the refresh
          setTimeout(() => {
            MySwal.fire({
              title: 'Page Refreshed!',
              text: 'The page has been refreshed with the latest data.',
              icon: 'info',
              timer: 2000,
              showConfirmButton: false,
              background: '#1f2937',
              color: 'white',
              customClass: {
                popup: 'backdrop-blur-sm bg-gray-900/95 border border-white/10'
              }
            });
          }, 500);
          
        } else {
          throw new Error(result.message);
        }
      } catch (error) {
        await syncingModal.close();
        
        MySwal.fire({
          icon: 'error',
          title: 'Sync Failed',
          text: error.message || 'Failed to sync sites. Please try again.',
          confirmButtonColor: '#dc2626',
          background: '#1f2937',
          color: 'white',
          customClass: {
            popup: 'backdrop-blur-sm bg-gray-900/95 border border-white/10',
            title: 'text-white'
          }
        });
      } finally {
        setSyncing(false);
      }
    }
  };

  const handleLogout = async () => {
    // Close profile dropdown
    setProfileOpen(false);
    
    const result = await MySwal.fire({
      title: 'Are you sure?',
      text: "You will be logged out of the system.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, logout',
      cancelButtonText: 'Cancel',
      background: '#1f2937',
      color: 'white',
    });

    if (result.isConfirmed) {
      try {
        await logout();
        await MySwal.fire({
          title: 'Logged out!',
          text: 'You have been successfully logged out.',
          icon: 'success',
          confirmButtonColor: '#10b981',
          background: '#1f2937',
          color: 'white',
        });
      } catch (error) {
        MySwal.fire({
          icon: 'error',
          title: 'Logout Failed',
          text: 'Could not logout. Please try again.',
          confirmButtonColor: '#dc2626',
          background: '#1f2937',
          color: 'white',
        });
      }
    }
  };

  const toggleProfileDropdown = () => {
    setProfileOpen(!profileOpen);
  };

  const SidebarContent = () => (
    <>
      <nav className="space-y-2">
        {links
          .filter(link => !link.role || link.role === user?.role)
          .map(({ name, href, icon }) => (
            <Link
              key={name}
              href={href}
              className="flex items-center gap-3 hover:bg-white/10 rounded-lg px-4 py-3 transition-all duration-200 hover:translate-x-1"
              onClick={() => setSidebarOpen(false)}
            >
              {icon}
              <span className="font-medium">{name}</span>
            </Link>
          ))}
      </nav>
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Sidebar */}
      <motion.aside
        initial={{ x: '-100%' }}
        animate={{ x: sidebarOpen ? 0 : '-100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`fixed z-50 inset-y-0 left-0 w-64 p-5 md:hidden overflow-y-auto flex flex-col ${sidebarClass}`}
        aria-label="Sidebar"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold min-h-[28px]">
            <TypewriterText text="WINS MONITORING" speed={80} />
          </h2>
          <button 
            onClick={() => setSidebarOpen(false)} 
            aria-label="Close sidebar"
            className="hover:bg-white/10 p-1 rounded transition"
          >
            <X size={24} />
          </button>
        </div>
        <SidebarContent />
      </motion.aside>

      {/* Desktop Sidebar - Now FIXED not sticky */}
      <aside className={`hidden md:flex md:flex-col md:w-64 p-5 overflow-y-auto fixed top-0 left-0 h-full ${sidebarClass}`}>
        <h2 className="text-xl font-bold mb-6 ml-1 min-h-[28px]">
          <TypewriterText text="WINS MONITORING" speed={80} />
        </h2>
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <div className="md:ml-64">
        {/* Updated Header with Profile Dropdown */}
        <header className={`p-4 flex items-center justify-between fixed top-0 right-0 left-0 md:left-64 z-30 ${headerClass}`}>
          {/* Left side - Menu button (mobile only) */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden text-white focus:outline-none focus:ring-2 focus:ring-gray-500 rounded p-1 hover:bg-white/10 transition"
            aria-label="Open sidebar"
          >
            <Menu size={24} />
          </button>

          {/* Center - Empty space for mobile balance */}
          <div className="flex-1 md:hidden"></div>

          {/* Right side - Sync button, Profile dropdown, and notifications */}
          <div className="flex items-center gap-4 ml-auto">
            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={toggleProfileDropdown}
                className="flex items-center gap-3 hover:bg-white/10 rounded-lg px-3 py-2 transition-all duration-200 group"
                aria-label="User menu"
                aria-expanded={profileOpen}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                    <User size={18} />
                  </div>
                  <div className="text-right hidden md:block">
                    <p className="text-sm font-medium">{user?.name || 'User'}</p>
                    <p className="text-xs text-gray-300">{user?.role || 'Admin'}</p>
                  </div>
                </div>
                <ChevronDown 
                  size={16} 
                  className={`transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Profile Dropdown Menu */}
              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-2 w-72 bg-gray-800/95 backdrop-blur-lg border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
                  >
                    {/* User Info Section */}
                    <div className="p-4 border-b border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                          <User size={20} />
                        </div>
                        <div>
                          <p className="font-semibold">{user?.name || 'User'}</p>
                          <p className="text-sm text-gray-300">{user?.email || user?.username || 'user@example.com'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full">
                              {user?.role || 'Admin'}
                            </span>
                            <span className="text-xs px-2 py-1 bg-green-500/20 text-green-300 rounded-full">
                              Active
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="p-2 border-b border-white/10">
                      <button
                        onClick={handleSyncClick}
                        disabled={syncing}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                          syncing 
                            ? 'bg-blue-500/30 text-blue-300 cursor-not-allowed' 
                            : 'hover:bg-white/10 text-white'
                        }`}
                      >
                        <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
                        <div className="text-left flex-1">
                          <p className="font-medium">Sync Sites</p>
                          <p className="text-xs text-gray-400">
                            {syncing ? 'Synchronizing...' : 'Update from APIs'}
                          </p>
                        </div>
                      </button>
                    </div>

                    {/* Logout Section */}
                    <div className="p-2">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-500/20 text-red-300 transition-all duration-200 border border-red-500/30"
                      >
                        <LogOut size={18} />
                        <div className="text-left flex-1">
                          <p className="font-medium">Logout</p>
                          <p className="text-xs text-red-400/70">Sign out of your account</p>
                        </div>
                      </button>
                    </div>

                    {/* Footer */}
                    <div className="p-3 bg-black/30 text-center">
                      <p className="text-xs text-gray-400">
                        WINS Monitoring v1.0
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>
        
        {/* Page Content */}
        <main className="pt-16 p-4">
          {children}
        </main>
      </div>

      {/* Add custom CSS for animation delays */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animation-delay-150 {
          animation-delay: 150ms;
        }
        .animation-delay-200 {
          animation-delay: 200ms;
        }
        .animation-delay-300 {
          animation-delay: 300ms;
        }
        .animation-delay-400 {
          animation-delay: 400ms;
        }
        .animation-delay-600 {
          animation-delay: 600ms;
        }
        .animation-delay-800 {
          animation-delay: 800ms;
        }
        .animate-pulse {
          animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        /* SweetAlert2 Custom Styles */
        .swal2-popup {
          background: rgba(17, 24, 39, 0.95) !important;
          backdrop-filter: blur(12px) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 12px !important;
        }
        
        .swal2-title {
          color: #ffffff !important;
          font-weight: 600 !important;
        }
        
        .swal2-html-container {
          color: #d1d5db !important;
        }
        
        .swal2-confirm {
          background: linear-gradient(135deg, #3b82f6, #8b5cf6) !important;
          border: none !important;
          border-radius: 8px !important;
          font-weight: 500 !important;
        }
        
        .swal2-cancel {
          background: rgba(75, 85, 99, 0.8) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 8px !important;
          font-weight: 500 !important;
        }
      `}</style>
    </div>
  );
}