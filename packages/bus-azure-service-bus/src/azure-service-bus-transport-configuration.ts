import { ServiceBusClient } from '@azure/service-bus'

export type ServiceBusTransportConfiguration = {
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

  /**
   * The name of the queue to receive from.
   */
  queueName?: string

  /**
   * Name of the topic for the subscription we want to receive from. If Topic name is set subscription name is also should be set.
   */
  topicName?: string

  /**
   * Name of the subscription (under the `topic`) that we want to receive from. If Subscription name is set topic name is also should be set.
   */
  subscriptionName?: string
}
