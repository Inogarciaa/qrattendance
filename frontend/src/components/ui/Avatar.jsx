import { useState } from "react";
import { initials } from "../../lib/format";

/**
 * Round avatar used in dashboard lists. Falls back to initials when the person
 * has no photo, or when the photo URL fails to load.
 */
export default function Avatar({ name = "", photoUrl = null, size = "sm" }) {
  // Remember which URL failed so a newly uploaded photo gets another chance.
  const [brokenUri, setBrokenUri] = useState(null);

  const className = size === "sm" ? "av sm" : "av";
  const showPhoto = Boolean(photoUrl) && brokenUri !== photoUrl;

  if (!showPhoto) {
    return <span className={className}>{initials(name)}</span>;
  }

  return (
    <img
      className={className}
      src={photoUrl}
      alt=""
      loading="lazy"
      onError={() => setBrokenUri(photoUrl)}
    />
  );
}
