import { useState } from 'react'
import { Pause, Play, Sparkles } from 'lucide-react'

const message = 'O Lôro é um projeto 100% gratuito.'

export function FreeProjectBanner() {
  const [paused, setPaused] = useState(false)
  return (
    <div className="free-project-banner">
      <p className="free-project-static">{message}</p>
      <div className="free-project-viewport" aria-hidden="true">
        <div className="free-project-track" style={{ animationPlayState: paused ? 'paused' : 'running' }}>
          {[0, 1].map(group => (
            <div className="free-project-group" key={group}>
              {[0, 1].map(copy => <span key={copy}><Sparkles size={14} />{message}</span>)}
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="free-project-pause"
        aria-label={paused ? 'Retomar mensagem' : 'Pausar mensagem'}
        onClick={() => setPaused(value => !value)}
      >
        {paused ? <Play size={15} /> : <Pause size={15} />}
      </button>
    </div>
  )
}
