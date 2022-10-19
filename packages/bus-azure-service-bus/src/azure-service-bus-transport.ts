import { CoreDependencies, Logger, Transport, TransportMessage } from '@node-ts/bus-core'
import { ServiceBusMessage } from '@azure/service-bus'
import { ServiceBusSender, ServiceBusReceiver, ServiceBusReceivedMessage } from '@azure/service-bus'
import { Command, MessageAttributes, Event, Message } from '@node-ts/bus-messages'
import { ServiceBusTransportConfiguration } from './azure-service-bus-transport-configuration'


type AttributeType = 'attributes' | 'stickyAttributes'
export class ServiceBusTransport implements Transport<ServiceBusMessage> {
  private coreDependencies: CoreDependencies
  private logger: Logger

  /**
   *
   */
  private readonly queueSender: ServiceBusSender
  /**
   *
   */
  private readonly queueReceiver: ServiceBusReceiver

  /**
   * A Custom Transport that supports Azure Sevice Bus Queue as an adapter for returnMessage
   *
   * @param serviceBusClient
   * @param queueName
   * @param maxWaitTimeInMs
   */
  constructor (
    private readonly serviceBusConfiguration: ServiceBusTransportConfiguration
  ) {
    if (serviceBusConfiguration.queueName) {
      this.queueReceiver = serviceBusConfiguration.serviceBusClient.createReceiver(serviceBusConfiguration.queueName, { receiveMode: 'peekLock' })
      this.queueSender = serviceBusConfiguration.serviceBusClient.createSender(serviceBusConfiguration.queueName)
    } else if (serviceBusConfiguration.topicName && serviceBusConfiguration.subscriptionName) {
      this.queueReceiver = serviceBusConfiguration.serviceBusClient.createReceiver(serviceBusConfiguration.topicName, serviceBusConfiguration.subscriptionName, { receiveMode: 'peekLock' })
      this.queueSender = serviceBusConfiguration.serviceBusClient.createSender(serviceBusConfiguration.topicName)
    } else {
      throw new Error('Queue or Topic Name (together with Subscription name) should be set.')
    }
  }

  prepare (coreDependencies: CoreDependencies): void {
    this.coreDependencies = coreDependencies
    this.logger = coreDependencies.loggerFactory('@node-ts/bus-azure-sbq:azure-sbq-transport')
  }

  async publish<EventType extends Event> (event: EventType, messageAttributes?: MessageAttributes): Promise<void> {
    await this.publishMessage(event, messageAttributes)
  }

  async send<CommandType extends Command> (command: CommandType, messageAttributes?: MessageAttributes): Promise<void> {
    await this.publishMessage(command, messageAttributes)
  }

  async fail (transportMessage: TransportMessage<ServiceBusReceivedMessage>): Promise<void> {
    await this.queueReceiver.deadLetterMessage(transportMessage.raw)
  }

  async readNextMessage (): Promise<TransportMessage<ServiceBusReceivedMessage> | undefined> {
    const configuration = {
      maxMessageCount: 1
    }
    const result = await this.queueReceiver.receiveMessages(configuration.maxMessageCount, { maxWaitTimeInMs: this.serviceBusConfiguration.waitTimeSeconds })

    if (result.length === 0) {
      return undefined
    }

    // This should not happen as we are hardcoding the maxMessageCount to 1 but in any case impossible will become possible then just return all the message to queue
    if (result.length > 1) {
      this.logger.error(
        'Received more than the expected number of messages',
        { expected: 1, received: result.length }
      )

      // If this happened just return this message to Queue
      await Promise.allSettled(
        result.map(async message => this.queueReceiver.abandonMessage(message))
      )
      return undefined
    }

    const queueMessage = result[0]

    // By default @azure/service-bus can deserialize JSON string. For plain text it uses the buffer
    const domainMessage = Buffer.isBuffer(queueMessage.body) ? queueMessage.body.toString() : queueMessage.body

    return {
      id: queueMessage.messageId?.toString(),
      raw: queueMessage,
      domainMessage,
      attributes: {
        correlationId: queueMessage?.correlationId?.toString(),
        attributes: (queueMessage.applicationProperties ) ? this.transformApplicationPropertiesToAttributes('attributes', queueMessage.applicationProperties) : { },
        stickyAttributes: (queueMessage.applicationProperties ) ? this.transformApplicationPropertiesToAttributes('stickyAttributes', queueMessage.applicationProperties) : { }
      }
    }

  }

  async deleteMessage (message: TransportMessage<ServiceBusReceivedMessage>): Promise<void> {
    await this.queueReceiver.completeMessage(message.raw)
  }

  async returnMessage (message: TransportMessage<ServiceBusReceivedMessage>): Promise<void> {
    await this.queueReceiver.abandonMessage(message.raw)
  }

  async initialize (): Promise<void> {
  }

  private transformApplicationPropertiesToAttributes (
    attributeType: AttributeType,
    properties: ServiceBusMessage['applicationProperties']
  ): MessageAttributes['attributes'] | MessageAttributes['stickyAttributes'] {
    const transformedObject: MessageAttributes['attributes'] = {}
    const keyPrefix = `${attributeType}-`

    if (!properties) {
      return {}
    }

    for (const [key, value] of Object.entries(properties)) {
      let newValue: string | number | boolean | undefined

      // Type casting here to make sure TS is happy
      if (value === null) {
        newValue = undefined
      } else if (value instanceof Date) {
        newValue = value.toISOString()
      } else {
        newValue = value
      }

      // For ApplicationProperties that are correctly tagged with either of the prefix attributes or stickyAttributes
      if (key.startsWith(keyPrefix)) {
        transformedObject[key.replace(keyPrefix, '')]  = newValue
      // For those key that don't use the keyPrefix naming default it as attributes.
      } else if (attributeType === 'attributes' && !key.startsWith('stickyAttributes-')) {
        transformedObject[key] = newValue
      }
    }

    return transformedObject
  }

  private transformAttributeToApplicationProperties(
    attributeType: AttributeType,
    attributes: MessageAttributes['attributes'] |  MessageAttributes['stickyAttributes'], 
  ): ServiceBusMessage['applicationProperties'] {
    const transformedObject: ServiceBusMessage['applicationProperties'] = {}
    const keyPrefix = `${attributeType}-`

    // Type casting here to make sure TS is happy
    for (const [key, value] of Object.entries(attributes)) {
      let newValue: number | boolean | string | Date | null

      // No need to add correlationId to Application Properties
      if (key === 'correlationId') {
        continue
      }
 
      if (value === undefined) {
        newValue = null 
      } else {
        newValue = value
      }

      transformedObject[`${keyPrefix}${key}`] = newValue
    }
    
    return transformedObject
  }

  private async publishMessage (
    message: Message,
    messageAttributes: MessageAttributes = { attributes: {}, stickyAttributes: {} }
  ): Promise<void> {
    const eventMessage: ServiceBusMessage = {
      body: message,
      correlationId: messageAttributes?.correlationId,
      subject: message.$name,
      applicationProperties: { 
        ...this.transformAttributeToApplicationProperties('attributes', messageAttributes.attributes),
        ...this.transformAttributeToApplicationProperties('stickyAttributes', messageAttributes.stickyAttributes) 
      }
    }
    await this.queueSender.sendMessages(eventMessage)
  }
}
