import { useNavigate } from 'react-router-dom'

export default function Header({ backTo, backLabel = 'Volver' }) {
  const navigate = useNavigate()
  return (
    <div className="flex items-center justify-between mb-6">
      {backTo ? (
        <button
          onClick={() => navigate(backTo)}
          className="btn-secondary flex items-center gap-1"
        >
          <span>←</span> {backLabel}
        </button>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-1.5 font-extrabold text-lg">
        <img src="/logo.png" alt="" className="w-6 h-6 rounded-full object-cover" />
        <span>LsPadel<span className="text-brand">Pro</span></span>
      </div>
    </div>
  )
}
