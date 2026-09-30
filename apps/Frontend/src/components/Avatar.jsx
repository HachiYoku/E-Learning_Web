import { UserRound } from "lucide-react";
import { getAvatarInitial } from "./avatarUtils";

function Avatar({ src, name, alt = "", className = "", fallbackClassName = "" }) {
  if (src) return <img src={src} alt={alt} className={className} />;

  const initial = getAvatarInitial(name);
  return (
    <span
      aria-label={alt || undefined}
      className={`inline-flex shrink-0 items-center justify-center ${fallbackClassName || className}`}
    >
      {initial ? initial : <UserRound aria-hidden="true" className="h-1/2 w-1/2" />}
    </span>
  );
}

export default Avatar;
