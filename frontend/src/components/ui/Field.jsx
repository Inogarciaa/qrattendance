export default function Field({ id, label, error, hint, required, children, full }) {
  return (
    <div className={full ? 'field full' : 'field'}>
      {label && (
        <label className="lb" htmlFor={id}>
          {label}
          {required && <span className="req" aria-hidden="true"> *</span>}
        </label>
      )}
      {children}
      {hint && <div className="hint">{hint}</div>}
      {error && <span className="err" role="alert">{error}</span>}
    </div>
  );
}
