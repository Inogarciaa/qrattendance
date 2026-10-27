export default function StatusBadge({ status }) {
  return <span className={"bg " + status}>{status}</span>;
}
