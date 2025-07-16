"use client";

import { useDarkMode } from "@/hooks/useDarkMode";
import React, { useState, useRef, useEffect } from "react";
import {
  LogIn,
  UserPlus,
  Terminal,
  Shield,
  Cpu,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";

export default function CyberHeader() {
  const { darkMode } = useDarkMode();
  const { data: session, status } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen);
  };
  const handleSignIn = () => {
    // ★ 新規
    const callbackUrl = pathname === "/" ? "/hackSetUp" : pathname;
    signIn("github", { callbackUrl });
  };

  const handleLogout = () => {
    setIsMenuOpen(false);
    signOut({ callbackUrl: "/" });
  };

  const handleSettings = () => {
    setIsMenuOpen(false);
    router.push("/settings");
  };

  return (
    <>
      <header className="absolute z-100 w-full">
        {/* Cyber glow effect */}
        <div className={`absolute inset-0 `}></div>

        <div className="container mx-auto px-6 py-6 relative">
          <div className="flex items-center justify-between">
            {/* Cyber Logo */}
            <div className="flex items-center space-x-4 group">
              <div
                className={`relative w-12 h-12 rounded-lg ${
                  darkMode
                    ? "bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500"
                    : "bg-gradient-to-br from-purple-500 via-blue-500 to-indigo-500"
                } flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3`}
              >
                {/* Inner glow effect */}
                <div
                  className={`absolute inset-1 rounded ${
                    darkMode
                      ? "bg-gradient-to-br from-cyan-400/20 to-pink-400/20"
                      : "bg-gradient-to-br from-purple-400/20 to-blue-400/20"
                  } blur-sm`}
                ></div>
                <Terminal
                  className="text-white font-bold text-lg relative z-10"
                  size={24}
                />
                {/* Corner brackets */}
                <div
                  className={`absolute -top-1 -left-1 w-3 h-3 border-l-2 border-t-2 ${
                    darkMode ? "border-cyan-400" : "border-purple-300"
                  }`}
                ></div>
                <div
                  className={`absolute -top-1 -right-1 w-3 h-3 border-r-2 border-t-2 ${
                    darkMode ? "border-pink-400" : "border-blue-300"
                  }`}
                ></div>
                <div
                  className={`absolute -bottom-1 -left-1 w-3 h-3 border-l-2 border-b-2 ${
                    darkMode ? "border-pink-400" : "border-blue-300"
                  }`}
                ></div>
                <div
                  className={`absolute -bottom-1 -right-1 w-3 h-3 border-r-2 border-b-2 ${
                    darkMode ? "border-cyan-400" : "border-purple-300"
                  }`}
                ></div>
              </div>

              <div className="flex flex-col">
                <span
                  className={`text-xl font-bold tracking-widest ${
                    darkMode
                      ? "text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-400"
                      : "text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600"
                  } filter drop-shadow-lg`}
                >
                  Hackathon
                </span>
                <span
                  className={`text-1xl font-bold tracking-widest ${
                    darkMode
                      ? "text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-400"
                      : "text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600"
                  } filter drop-shadow-lg`}
                >
                  SupportAgent
                </span>
                <span
                  className={`text-xs font-mono tracking-wider ${
                    darkMode ? "text-cyan-300/70" : "text-purple-500/70"
                  }`}
                >
                  // SYSTEM_ONLINE
                </span>
              </div>
            </div>

            {/* Cyber Authentication Section */}
            <div className="flex items-center space-x-4">
              {status === "loading" && (
                <div
                  className={`relative px-6 py-3 rounded-lg backdrop-blur-sm border ${
                    darkMode
                      ? "bg-gray-900/50 border-cyan-500/30 text-cyan-400"
                      : "bg-white/50 border-purple-300/30 text-purple-600"
                  } shadow-lg overflow-hidden`}
                >
                  {/* Scanning line effect */}
                  <div
                    className={`absolute inset-0 ${
                      darkMode
                        ? "bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent"
                        : "bg-gradient-to-r from-transparent via-purple-400/10 to-transparent"
                    } translate-x-[-100%] animate-pulse`}
                  ></div>
                  <div className="flex items-center space-x-3 relative">
                    <div
                      className={`animate-spin rounded-full h-5 w-5 border-2 ${
                        darkMode
                          ? "border-cyan-400 border-t-transparent"
                          : "border-purple-600 border-t-transparent"
                      }`}
                    ></div>
                    <span className="text-sm font-mono font-bold tracking-wider">
                      LOADING...
                    </span>
                  </div>
                </div>
              )}

              {!session && (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleSignIn}
                    className={`group relative px-6 py-3 rounded-lg font-mono font-bold text-sm tracking-wider transition-all duration-300 overflow-hidden ${
                      darkMode
                        ? "bg-gray-900/50 hover:bg-gray-800/70 text-gray-300 hover:text-cyan-400 border border-gray-600/50 hover:border-cyan-500/70"
                        : "bg-white/50 hover:bg-gray-50/70 text-gray-600 hover:text-purple-600 border border-gray-300/50 hover:border-purple-400/70"
                    } backdrop-blur-sm shadow-lg hover:shadow-xl transform hover:scale-105`}
                  >
                    {/* Cyber scan line */}
                    <div
                      className={`absolute inset-0 ${
                        darkMode
                          ? "bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent"
                          : "bg-gradient-to-r from-transparent via-purple-400/20 to-transparent"
                      } translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700`}
                    ></div>
                    <div className="flex items-center space-x-2 relative">
                      <Shield className="w-4 h-4" />
                      <span>ACCESS</span>
                    </div>
                    {/* Corner brackets */}
                    <div
                      className={`absolute top-1 left-1 w-2 h-2 border-l border-t ${
                        darkMode ? "border-cyan-400/50" : "border-purple-400/50"
                      } opacity-0 group-hover:opacity-100 transition-opacity`}
                    ></div>
                    <div
                      className={`absolute top-1 right-1 w-2 h-2 border-r border-t ${
                        darkMode ? "border-cyan-400/50" : "border-purple-400/50"
                      } opacity-0 group-hover:opacity-100 transition-opacity`}
                    ></div>
                  </button>
                </div>
              )}

              {session && (
                <div
                  className="flex items-center space-x-4 relative"
                  ref={menuRef}
                >
                  <button
                    onClick={handleMenuToggle}
                    className={`relative px-6 py-3 rounded-lg backdrop-blur-sm border transition-all duration-300 ${
                      darkMode
                        ? "bg-gray-900/50 border-cyan-500/30 hover:border-cyan-400/50"
                        : "bg-white/50 border-purple-300/30 hover:border-purple-400/50"
                    } shadow-lg overflow-hidden hover:shadow-xl group`}
                  >
                    {/* Status indicator */}
                    <div
                      className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                        darkMode ? "bg-green-400" : "bg-green-500"
                      } animate-pulse`}
                    ></div>
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <img
                          src={session.user?.image ?? ""}
                          alt="Profile"
                          className={`w-10 h-10 rounded-lg border-2 transition-all duration-300 ${
                            darkMode
                              ? "border-cyan-500/50 group-hover:border-cyan-400"
                              : "border-purple-500/50 group-hover:border-purple-400"
                          }`}
                        />
                        {/* Cyber frame */}
                        <div
                          className={`absolute -inset-1 border transition-all duration-300 ${
                            darkMode
                              ? "border-cyan-400/30 group-hover:border-cyan-400/50"
                              : "border-purple-400/30 group-hover:border-purple-400/50"
                          } rounded-lg`}
                        ></div>
                      </div>
                      <div className="hidden sm:block">
                        <p
                          className={`text-sm font-mono font-bold tracking-wider ${
                            darkMode ? "text-cyan-400" : "text-purple-600"
                          }`}
                        >
                          USER_
                          {session.user?.name
                            ?.toUpperCase()
                            .replace(/\s+/g, "_")}
                        </p>
                        <div className="flex items-center space-x-1">
                          <span
                            className={`text-xs font-mono ${
                              darkMode ? "text-gray-400" : "text-gray-500"
                            }`}
                          >
                            // ONLINE
                          </span>
                          <ChevronDown
                            className={`w-3 h-3 transition-transform duration-300 ${
                              isMenuOpen ? "rotate-180" : ""
                            } ${darkMode ? "text-cyan-400" : "text-purple-600"}`}
                          />
                        </div>
                      </div>
                      <div className="sm:hidden">
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-300 ${
                            isMenuOpen ? "rotate-180" : ""
                          } ${darkMode ? "text-cyan-400" : "text-purple-600"}`}
                        />
                      </div>
                    </div>
                  </button>

                  {/* Dropdown Menu */}
                  {isMenuOpen && (
                    <div
                      className={`absolute top-full right-0 mt-2 w-64 rounded-lg backdrop-blur-md border shadow-xl z-50 overflow-hidden ${
                        darkMode
                          ? "bg-gray-900/90 border-cyan-500/30"
                          : "bg-white/90 border-purple-300/30"
                      }`}
                    >
                      {/* Menu Header */}
                      <div
                        className={`px-4 py-3 border-b ${
                          darkMode
                            ? "border-cyan-500/20"
                            : "border-purple-300/20"
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <img
                            src={session.user?.image ?? ""}
                            alt="Profile"
                            className={`w-8 h-8 rounded border ${
                              darkMode
                                ? "border-cyan-500/50"
                                : "border-purple-500/50"
                            }`}
                          />
                          <div>
                            <p
                              className={`text-sm font-mono font-bold ${
                                darkMode ? "text-cyan-400" : "text-purple-600"
                              }`}
                            >
                              {session.user?.name}
                            </p>
                            <p
                              className={`text-xs font-mono ${
                                darkMode ? "text-gray-400" : "text-gray-500"
                              }`}
                            >
                              {session.user?.email}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Menu Items */}
                      <div className="py-2">
                        <button
                          onClick={handleSettings}
                          className={`w-full px-4 py-3 text-left flex items-center space-x-3 transition-all duration-200 ${
                            darkMode
                              ? "hover:bg-cyan-500/10 text-gray-300 hover:text-cyan-400"
                              : "hover:bg-purple-500/10 text-gray-600 hover:text-purple-600"
                          }`}
                        >
                          <div className="relative">
                            <Settings className="w-5 h-5" />
                            {/* Cyber brackets */}
                            <div
                              className={`absolute -top-1 -left-1 w-2 h-2 border-l border-t ${
                                darkMode
                                  ? "border-cyan-400/50"
                                  : "border-purple-400/50"
                              }`}
                            ></div>
                            <div
                              className={`absolute -bottom-1 -right-1 w-2 h-2 border-r border-b ${
                                darkMode
                                  ? "border-cyan-400/50"
                                  : "border-purple-400/50"
                              }`}
                            ></div>
                          </div>
                          <div>
                            <span className="font-mono font-bold text-sm tracking-wider">
                              SETTINGS
                            </span>
                            <p
                              className={`text-xs font-mono ${
                                darkMode ? "text-gray-500" : "text-gray-400"
                              }`}
                            >
                              // Configure system
                            </p>
                          </div>
                        </button>

                        <div
                          className={`mx-4 my-2 h-px ${
                            darkMode ? "bg-cyan-500/20" : "bg-purple-300/20"
                          }`}
                        ></div>

                        <button
                          onClick={handleLogout}
                          className={`w-full px-4 py-3 text-left flex items-center space-x-3 transition-all duration-200 ${
                            darkMode
                              ? "hover:bg-red-500/10 text-gray-300 hover:text-red-400"
                              : "hover:bg-red-500/10 text-gray-600 hover:text-red-600"
                          }`}
                        >
                          <div className="relative">
                            <LogOut className="w-5 h-5" />
                            {/* Warning brackets */}
                            <div
                              className={`absolute -top-1 -left-1 w-2 h-2 border-l border-t ${
                                darkMode
                                  ? "border-red-400/50"
                                  : "border-red-500/50"
                              }`}
                            ></div>
                            <div
                              className={`absolute -bottom-1 -right-1 w-2 h-2 border-r border-b ${
                                darkMode
                                  ? "border-red-400/50"
                                  : "border-red-500/50"
                              }`}
                            ></div>
                          </div>
                          <div>
                            <span className="font-mono font-bold text-sm tracking-wider">
                              LOGOUT
                            </span>
                            <p
                              className={`text-xs font-mono ${
                                darkMode ? "text-gray-500" : "text-gray-400"
                              }`}
                            >
                              // End session
                            </p>
                          </div>
                        </button>
                      </div>

                      {/* Menu Footer */}
                      <div
                        className={`px-4 py-2 border-t ${
                          darkMode
                            ? "border-cyan-500/20 bg-gray-800/50"
                            : "border-purple-300/20 bg-gray-50/50"
                        }`}
                      >
                        <p
                          className={`text-xs font-mono text-center ${
                            darkMode ? "text-gray-500" : "text-gray-400"
                          }`}
                        >
                          // SYSTEM_ACCESS_GRANTED
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
