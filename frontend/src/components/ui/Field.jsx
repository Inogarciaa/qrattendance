export default function Field({ id, label, required, error, full, children }) {
  return (
    <div className={full ? "full" : ""}>
      <label htmlFor={id}>
        {label}
        {required && <span className="req"> *</span>}
      </label>
      {children}
      {error && (
        <span className="err" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
