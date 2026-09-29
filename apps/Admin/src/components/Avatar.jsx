import { UserRound } from "lucide-react";
import { avatarInitial } from "./avatarUtils";

export function Avatar({ src, name, alt = "", className = "", fallbackClassName = "" }) {
  if (src) return <img src={src} alt={alt} className={className} />;

  const initial = avatarInitial(name);
  return (
    <span aria-label={alt || undefined} className={`inline-flex shrink-0 items-center justify-center ${fallbackClassName || className}`}>
      {initial || <UserRound aria-hidden="true" className="h-1/2 w-1/2" />}
    </span>
  );
}
