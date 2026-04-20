import React from 'react'

export class RouteCrashBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error('Protected route crashed during render', error)
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

export function ProtectedRouteFallback() {
  const handleReload = () => {
    window.location.reload()
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="noire-panel max-w-xl rounded-[28px] p-8 text-center">
        <p className="page-header-kicker mb-2">Booting the signal</p>
        <h2 className="text-2xl font-semibold text-white">Your orbit is still settling.</h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-400">
          Spotify auth succeeded, but one of the post-login surfaces failed to fully settle. Melody Map is holding the shell open instead of dropping you into a blank page.
        </p>
        <p className="mt-4 text-xs uppercase tracking-[0.22em] text-gray-500">
          Try refreshing once if the quieter boot state does not clear.
        </p>
        <button
          type="button"
          onClick={handleReload}
          className="mt-5 noire-chip rounded-full px-4 py-2 text-xs font-semibold text-white"
        >
          Reload the shell
        </button>
      </div>
    </div>
  )
}

export function GlobalRouteFallback() {
  const handleReload = () => {
    window.location.reload()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 app-shell-bg">
      <div className="noire-panel max-w-lg rounded-[28px] p-8 text-center">
        <p className="page-header-kicker mb-2">Holding the thread</p>
        <h1 className="text-2xl font-semibold text-white">Melody Map hit a render fault.</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-400">
          The app caught a runtime crash before it could turn into a blank screen. Your session is still there, and a reload should bring the surface back.
        </p>
        <button
          type="button"
          onClick={handleReload}
          className="mt-5 noire-chip rounded-full px-4 py-2 text-xs font-semibold text-white"
        >
          Reload Melody Map
        </button>
      </div>
    </div>
  )
}
