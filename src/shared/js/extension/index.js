/**
 * 'Extension' refers to extension as it is - without transitions logic,
 * all necessary condition checks, etc.
 *
 * Transitions and other changes, depending on the extension state,
 * are defined in 'actions'.
 */
import { Extension, server } from './base'
import { actions, configService } from './stateManager'

export { actions, configService, Extension, server }
