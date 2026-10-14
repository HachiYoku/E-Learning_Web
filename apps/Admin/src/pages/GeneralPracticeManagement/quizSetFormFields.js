export const SET_DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced']

export function setFormFrom(set) {
  return { name: set?.name || '', description: set?.description || '',
    difficulty: set?.difficulty || '', coverImage: set?.coverImage || '' }
}

export function validateSetForm(form) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Enter a Quiz Set name.'
  else if (form.name.trim().length > 140) errors.name = 'Keep the name within 140 characters.'
  if (form.description.trim().length > 1000) errors.description = 'Keep the description within 1000 characters.'
  if (form.difficulty && !SET_DIFFICULTIES.includes(form.difficulty)) errors.difficulty = 'Choose a supported difficulty.'
  if (form.coverImage.trim()) {
    if (form.coverImage.trim().length > 2048) errors.coverImage = 'Keep the cover URL within 2048 characters.'
    else {
      try {
        const url = new URL(form.coverImage.trim())
        if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.username || url.password || !url.pathname.includes('/image/upload/')) throw new Error()
      } catch { errors.coverImage = 'Use a Cloudinary HTTPS image URL.' }
    }
  }
  return errors
}

export function setFormPayload(form) {
  return { name: form.name.trim(), description: form.description.trim(),
    difficulty: form.difficulty || null, coverImage: form.coverImage.trim() }
}
