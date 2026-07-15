const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

export function validateFileSize(file, label = "File") {
  if (!file) {
    return ""
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `${label} must be 5 MB or smaller.`
  }

  return ""
}

export { MAX_FILE_SIZE_BYTES }
