import { useState } from 'react'
import { useStudio } from '../domain/store'
import { RecipePanel } from './panels/RecipePanel'
import { DepthPanel } from './panels/DepthPanel'
import { LearnPanel } from './panels/LearnPanel'

type Tab = 'recipe' | 'depth' | 'learn'

export function SidePanel() {
  const learningMode = useStudio((s) => s.learningMode)
  const [selectedTab, setTab] = useState<Tab>('recipe')
  // The Learn tab only exists in learning mode; derive rather than sync.
  const tab: Tab = !learningMode && selectedTab === 'learn' ? 'recipe' : selectedTab

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-bloom-200 bg-white/70">
      <div className="flex border-b border-bloom-200" role="tablist" aria-label="Design details">
        <TabButton id="recipe" label="Recipe" active={tab === 'recipe'} onSelect={() => setTab('recipe')} />
        <TabButton id="depth" label="Depth" active={tab === 'depth'} onSelect={() => setTab('depth')} />
        {learningMode && (
          <TabButton id="learn" label="Learn" active={tab === 'learn'} onSelect={() => setTab('learn')} />
        )}
      </div>
      <div
        className="scroll-slim flex-1 overflow-y-auto p-3"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
      >
        {tab === 'recipe' ? <RecipePanel /> : tab === 'depth' ? <DepthPanel /> : <LearnPanel />}
      </div>
    </aside>
  )
}

function TabButton({
  id,
  label,
  active,
  onSelect,
}: {
  id: string
  label: string
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      id={`tab-${id}`}
      role="tab"
      aria-selected={active}
      className={`flex-1 px-3 py-2 text-sm font-semibold transition-colors ${
        active
          ? 'border-b-2 border-bloom-600 text-bloom-700'
          : 'text-bloom-ink/50 hover:text-bloom-ink'
      }`}
      onClick={onSelect}
    >
      {label}
    </button>
  )
}
