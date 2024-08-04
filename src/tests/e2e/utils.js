// have to redefine getIconName - otherwise, import from utilities
// causes weird namespace mixing error
export const getIconName = (path) => {
  const pattern = /([^/]+)\.(png|svg)$/
  const match = path.match(pattern)

  if (match) {
    return match[1]
  }
  return undefined
}

export const waitFor = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))
