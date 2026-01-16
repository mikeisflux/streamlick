import { Link } from 'react-router-dom';
import { Play, Users, Radio, Zap } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-brand-900/20">
      {/* Header */}
      <header className="container mx-auto px-6 py-6">
        <nav className="flex items-center justify-between">
          <div className="text-2xl font-bold bg-gradient-to-r from-brand-400 to-brand-600 text-transparent bg-clip-text">
            Streamlick
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-dark-300 hover:text-white transition">
              Login
            </Link>
            <Link
              to="/register"
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg font-medium transition"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <main className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Professional Live Streaming
            <span className="block bg-gradient-to-r from-brand-400 to-brand-600 text-transparent bg-clip-text">
              Made Simple
            </span>
          </h1>
          <p className="text-xl text-dark-300 mb-10 max-w-2xl mx-auto">
            Create stunning live broadcasts with multiple guests, custom branding, and stream to all your platforms simultaneously.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="px-8 py-4 bg-brand-600 hover:bg-brand-700 rounded-xl font-semibold text-lg transition transform hover:scale-105"
            >
              Start Broadcasting Free
            </Link>
            <Link
              to="/login"
              className="px-8 py-4 bg-dark-800 hover:bg-dark-700 rounded-xl font-semibold text-lg transition"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-32 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 bg-dark-800/50 rounded-2xl border border-dark-700">
            <div className="w-12 h-12 bg-brand-600/20 rounded-xl flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-brand-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Multi-Guest Shows</h3>
            <p className="text-dark-400">
              Invite up to 10 guests to join your live broadcast with a simple link.
            </p>
          </div>

          <div className="p-6 bg-dark-800/50 rounded-2xl border border-dark-700">
            <div className="w-12 h-12 bg-brand-600/20 rounded-xl flex items-center justify-center mb-4">
              <Radio className="w-6 h-6 text-brand-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Multistream</h3>
            <p className="text-dark-400">
              Stream to YouTube, Twitch, Facebook, and custom RTMP destinations at once.
            </p>
          </div>

          <div className="p-6 bg-dark-800/50 rounded-2xl border border-dark-700">
            <div className="w-12 h-12 bg-brand-600/20 rounded-xl flex items-center justify-center mb-4">
              <Play className="w-6 h-6 text-brand-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Live Preview</h3>
            <p className="text-dark-400">
              See exactly what your viewers see with real-time preview before and during broadcast.
            </p>
          </div>

          <div className="p-6 bg-dark-800/50 rounded-2xl border border-dark-700">
            <div className="w-12 h-12 bg-brand-600/20 rounded-xl flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-brand-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Custom Branding</h3>
            <p className="text-dark-400">
              Add your logo, custom backgrounds, lower thirds, and more to stand out.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-12 mt-20 border-t border-dark-800">
        <div className="text-center text-dark-500">
          &copy; {new Date().getFullYear()} Streamlick. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
