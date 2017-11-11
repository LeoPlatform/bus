# bus

## Better Data Flow
LEO EventBus is an open source, serverless event streaming platform based on event sourcing. LEO EventBus utilizes Amazon services such as Kinesis, DynamoDB, S3, and Lambda and is deployed in your own Amazon cloud. Think of it as a serverless Kafka alternative in your own Amazon cloud. 

Benefits
- Multiple stream events (or Topics) on one Kinesis Stream
- Durability of stream events 
- Replay of stream events
- Unlimited Subscribers to any stream event
- Lower AWS cost through reusing Kinesis, gziping data, auto archiving.   

## Kafka-like comparison
Kafka | LEO
------------ | -------------
Communication Stream | Kinesis
Service Catalog *(# of Subscribers, where in log)* | DynamoDB
Notification & Broker | Lambda
Data Store | S3, DynamoDB

## LEO Architecture
![screen](https://user-images.githubusercontent.com/16600791/32670968-d7a1bf2e-c602-11e7-9f0c-d13d1c07fb94.png)

## Use Cases
LEO is great at solving these types of business problems
- System integrations
- Business Intelligence and Data Warehousing
- Big Data and Data Science projects
- Microservice async communication
- Machine Learning and AI

All of these projects require access to core business events which can be easily streamed to LEO. Once in LEO, the same data event can be leveraged for all data projects. When your data flows, innovation follows.  

## Setup
Go to cloudformation
![pasted image at 2017_11_10 08_34 pm](https://user-images.githubusercontent.com/1404265/32686376-5b737fe6-c661-11e7-82c8-e27dd6d15de0.png)

click "Create Stack"


