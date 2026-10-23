import { route } from 'preact-router'

export const navigate = (path: string, replace = false) =>
  route(path, replace)
