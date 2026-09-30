export function getAvatarInitial(name) {
  const firstCharacter = String(name || "").trim().match(/\S/u)?.[0];
  return firstCharacter ? firstCharacter.toLocaleUpperCase() : "";
}
