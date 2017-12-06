# bus

## Better Data Flow
LEO EventBus is an open source project connecting several AWS services (Kinesis, DynamoDB, S3 and Lambda) together to provide a more robust Data Pipeline.  LEO is deployed in your own Amazon cloud. Essentially, we created Apache Kafka for your own serverless AWS cloud.

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
Use LEO to solve these types of business problems
- Custom integrations
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

Specify an Amazon S3 template of https://s3-us-west-2.amazonaws.com/leoplatform/leo-bus/release/1.0.0/cloudformation.json and click "next"
![pasted image at 2017_11_10 08_37 pm](https://user-images.githubusercontent.com/1404265/32686436-1c16c44c-c662-11e7-8383-bd94c8f1d803.png)

Specify a name, click next
![pasted image at 2017_11_10 08_38 pm](https://user-images.githubusercontent.com/1404265/32686445-3dff8e68-c662-11e7-8058-2c95899ee3fd.png)

click next
![pasted image at 2017_11_10 08_38 pm 1](https://user-images.githubusercontent.com/1404265/32686459-61619eb4-c662-11e7-9029-50a38ddaf7da.png)

acknowledge that it might create IAM resources by clicking the checkbox.  Click Create
![pasted image at 2017_11_10 08_39 pm](https://user-images.githubusercontent.com/1404265/32686466-83b9f2ea-c662-11e7-850d-15e547bdb6da.png)

Wait for the status to change from create_in_progress to update_complete
![pasted image at 2017_11_10 08_40 pm](https://user-images.githubusercontent.com/1404265/32686475-ad2d4672-c662-11e7-8e6d-ac0f5b02a4b0.png)

Use one of our SDKs in order to interact with this stream
