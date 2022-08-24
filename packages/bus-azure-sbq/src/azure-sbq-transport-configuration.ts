import { ServiceBusClient } from '@azure/service-bus'
import { TransportConfiguration } from '@node-ts/bus-core'
export interface SBQTransportConfiguration extends TransportConfiguration {
  /**
   * Service Bus client instance from @azure/servicebus. This sets the connection handshake to Service Bus.
   */
  serviceBusClient: ServiceBusClient,

  /**
    * The maximum amount of time in milliseconds to wait for messages to arrive.
    * It also has a impact on shutdown duration because  is a non interruptable action.
    *
    * @default 60000
    */
   waitTimeSeconds?: number
}
