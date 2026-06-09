import { Component } from 'react'

/**
 * GalaxySceneBoundary
 * -------------------
 * A dedicated error boundary around the galaxy <Canvas>. Without it, a render
 * error thrown inside the 3D scene bubbles to the app-level RouteCrashBoundary
 * and is rendered as the generic "your orbit is still settling" auth fallback —
 * making 3D failures invisible and indistinguishable from auth/boot failures.
 *
 * This boundary instead:
 *   - logs the REAL error + component stack to the console tagged
 *     [GALAXY_SCENE_ERROR] so we can see which node/material/api threw, and
 *   - renders a minimal, visible in-place notice (intentionally plain — styling
 *     is a separate task) rather than tearing down the whole route.
 *
 * `resetKey` lets the scene recover automatically when the model/mode changes
 * (e.g. real data arrives after a demo render fault).
 */
export default class GalaxySceneBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || String(error) }
  }

  componentDidCatch(error, info) {
    /* eslint-disable no-console */
    console.error('[GALAXY_SCENE_ERROR]', error?.message || error)
    console.error('[GALAXY_SCENE_ERROR] stack:', error?.stack)
    console.error('[GALAXY_SCENE_ERROR] componentStack:', info?.componentStack)
    /* eslint-enable no-console */
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, message: '' })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            textAlign: 'center',
            color: '#fff',
            background: 'rgba(8,9,20,0.86)',
          }}
        >
          <div style={{ maxWidth: 440 }}>
            <p style={{ fontWeight: 700, marginBottom: 8 }}>Galaxy scene error</p>
            <p style={{ fontSize: 13, opacity: 0.75 }}>{this.state.message}</p>
            <p style={{ fontSize: 11, opacity: 0.5, marginTop: 10 }}>
              Logged to console as [GALAXY_SCENE_ERROR].
            </p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
