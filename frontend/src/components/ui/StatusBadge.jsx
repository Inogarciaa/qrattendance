export default function StatusBadge({ status }) {
  return (
    <span className={'bg ' + status}>
      <span className="bg-dot" aria-hidden="true" />
      {status}
    </span>
  );
}
