# @imaness/bus-azure-service-bus

An Azure Service Bus adapter for [@node-ts/bus](https://bus.node-ts.com)

🔥 View our docs at [https://bus.node-ts.com](https://bus.node-ts.com) 🔥

🤔 Have a question? [Join our Discord](https://discord.gg/Gg7v4xt82X) 🤔

## Installation

Install packages and their dependencies

```bash
npm i @imaness/bus-azure-service-bus @node-ts/bus-core
```

Once installed, configure Bus to use this transport during initialization:

```typescript
import { Bus } from '@node-ts/bus-core'
import { ServiceBusTransport, ServiceBusTransportConfiguration } from '@imaness/bus-azure-service-bus'

// For Using Service Bus Queue
const sbQueueConfiguration: ServiceBusTransportConfiguration = {
  queueName: {Queue Name},
  serviceBusClient:  new ServiceBusClient(),
}
const sbQueueTransport = new ServiceBusTransport(sbConfiguration)

// For Using Service Bus Topic
const sbTopicSubscriptionConfiguration: ServiceBusTransportConfiguration = {
  topicName: {Topic Name},
  subscriptionName: {Subscription Name},
  serviceBusClient:  new ServiceBusClient()
}
const sbTopicTransport = new ServiceBusTransport(sbConfiguration)

// Configure Bus to use Azure Service Bus Queue as a transport
const run = async () => {
  await Bus
    .configure()
    .withTransport({ sbQueueTransport or sbTopicTransport })
    .initialize()
}
run.catch(console.error)
```

### Mapping of ApplicationProperties to Attributes and StickyAttributes

Azure Service Bus supports [Message Properties](https://docs.microsoft.com/en-us/rest/api/servicebus/message-headers-and-properties#message-properties). 

In order for you to map it to Attributes or StickyAttributes you need to add key prefix of either `attributes` or `stickyAttributes`. Those key that are not have the said prefixes will be considered as `attributes`.
