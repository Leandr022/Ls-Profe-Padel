const CONTACT_EMAIL = 'leandro.santagada@icloud.com'

export default function LegalDoc({ title, updated, sections }) {
  return (
    <div>
      <h1 className="text-xl font-extrabold mb-0.5">{title}</h1>
      <p className="text-slate-400 text-xs mb-5">{updated}</p>

      <div className="space-y-5">
        {sections.map((s) => (
          <div key={s.title}>
            <div className="font-bold text-sm mb-1.5">{s.title}</div>
            <div className="space-y-2.5">
              {s.body.map((p, i) => (
                <p key={i} className="text-sm text-slate-300 leading-relaxed">
                  {p === 'contact-email' ? (
                    <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand underline decoration-dotted">
                      {CONTACT_EMAIL}
                    </a>
                  ) : (
                    p
                  )}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
