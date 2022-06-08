import { CoreDependencies, Logger, Transport, TransportMessage } from "@node-ts/bus-core";
import { ServiceBusMessage } from '@azure/service-bus'
import { ServiceBusClient, ServiceBusSender, ServiceBusReceiver, ServiceBusReceivedMessage } from "@azure/service-bus"
import { Command, MessageAttributes, Event, Message } from "@node-ts/bus-messages";
import uuid from "uuid";
import { SBQTransportConfiguration } from "./azure-sbq-transport-configuration";

export class SBQTransport implements Transport<ServiceBusMessage> {
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
  constructor(
    private readonly sbqConfiguration: SBQTransportConfiguration,
  ) {
    this.queueReceiver = sbqConfiguration.serviceBusClient.createReceiver(sbqConfiguration.queueName, { receiveMode: 'peekLock' })
    this.queueSender = sbqConfiguration.serviceBusClient.createSender(sbqConfiguration.queueName)
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
    const result = await this.queueReceiver.receiveMessages(configuration.maxMessageCount, { maxWaitTimeInMs: this.sbqConfiguration.waitTimeSeconds })

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
    const domainMessage = this.coreDependencies.messageSerializer.deserialize(queueMessage.body)

    return {
      id: queueMessage.messageId?.toString(),
      raw: queueMessage,
      domainMessage,
      attributes: {
        correlationId: queueMessage?.correlationId?.toString(),
        // TODO: Implement attributes
        attributes: {},
        stickyAttributes: {}
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

  private async publishMessage (
    message: Message,
    messageAttributes: MessageAttributes = { attributes: {}, stickyAttributes: {} }
  ): Promise<void> {
    const eventMessage: ServiceBusMessage = {
      body: JSON.stringify(message),
      correlationId: messageAttributes?.correlationId,
      subject: message.$name,
      // TODO: Implement attributes
      // applicationProperties: {
      //   ...messageAttributes?.attributes,
      //   ...messageAttributes?.stickyAttributes
      // }
    }
    await this.queueSender.sendMessages(eventMessage)
  }
}