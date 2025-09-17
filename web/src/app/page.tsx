import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-white mb-6">
            Kyarafit
          </h1>
          <p className="text-xl text-blue-200 mb-8 max-w-2xl mx-auto">
            The ultimate cosplay wardrobe and outfit planning app. 
            Organize, track, and design your perfect character coords.
          </p>
          <div className="space-x-4">
            <Link href="/auth/signin">
              <button className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors">
                Sign In
              </button>
            </Link>
            <Link href="/auth/signup">
              <button className="border-2 border-white text-white hover:bg-white hover:text-purple-900 font-bold py-3 px-8 rounded-lg text-lg transition-colors">
                Get Started
              </button>
            </Link>
          </div>
        </div>
        
        <div className="mt-20 grid md:grid-cols-3 gap-8">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
            <h3 className="text-2xl font-bold text-white mb-4">Closet Management</h3>
            <p className="text-blue-200">Upload and organize your costume pieces, wigs, and props with AI-powered cutouts.</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
            <h3 className="text-2xl font-bold text-white mb-4">Build Tracking</h3>
            <p className="text-blue-200">Track your cosplay builds from idea to completion with progress milestones.</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
            <h3 className="text-2xl font-bold text-white mb-4">Coord Builder</h3>
            <p className="text-blue-200">Design perfect character outfits with our drag-and-drop layered canvas.</p>
          </div>
        </div>
      </div>
    </main>
  )
}
