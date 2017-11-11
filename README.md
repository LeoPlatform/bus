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
![pasted image at 2017_11_10 08_34 pm 1](https://user-images.githubusercontent.com/1404265/32686413-b6f324b6-c661-11e7-817f-af956ddbfe37.png)

click "next"
![pasted image at 2017_11_10 08_37 pm](https://user-images.githubusercontent.com/1404265/32686436-1c16c44c-c662-11e7-8383-bd94c8f1d803.png)

Specify a name, click next
![pasted image at 2017_11_10 08_38 pm](https://user-images.githubusercontent.com/1404265/32686445-3dff8e68-c662-11e7-8058-2c95899ee3fd.png)

