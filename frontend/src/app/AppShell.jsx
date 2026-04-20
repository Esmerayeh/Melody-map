import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import useStore from '../store/useStore'
import { BrandBackdrop, BrandWatermark } from '../components/brand/BrandSystem'

export default function AppShell({ children }) {
  const cinemaMode = useStore((s) => s.cinemaMode)
  if (cinemaMode) {
    return <div className="h-screen overflow-hidden bg-surface">{children}</div>
  }

  return (
    <div className="relative flex h-screen overflow-hidden app-shell-bg">
      <BrandBackdrop opacity={0.26} />
      <BrandWatermark
        className="absolute right-[-4%] top-[8%] hidden w-[42rem] xl:block"
        opacity={0.09}
        rotate={-4}
        scale={1.06}
      />
      <BrandWatermark
        className="absolute bottom-[-8%] left-[-6%] hidden w-[34rem] lg:block"
        opacity={0.06}
        rotate={10}
        scale={0.92}
      />
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden app-main-shell">
        <TopBar />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
