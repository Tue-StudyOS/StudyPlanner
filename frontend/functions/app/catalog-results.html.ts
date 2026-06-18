import { proxyToGatewayTarget, type GatewayContext } from '../_shared/proxy.ts'

export async function onRequest(context: GatewayContext): Promise<Response> {
  return await proxyToGatewayTarget(context, 'mcp')
}
