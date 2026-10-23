import { createDomainIndex } from './domain-index'
import { findHostMatch } from './host-match'
import { isPrivateHost } from './private-host'
import type { RoutingOptions } from './routing'
import { createRouter, routingConfig } from './routing'

export const getPacScript = (options: RoutingOptions) => `
    var ctRoute = (${createRouter.toString()})(
      ${JSON.stringify(routingConfig(options))},
      ${findHostMatch.toString()}, ${isPrivateHost.toString()},
      ${createDomainIndex.toString()}
    );
    function FindProxyForURL(url, host) {
      return ctRoute(host).route;
    }`
