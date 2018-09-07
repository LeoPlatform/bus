module.exports = {
    Resources: {
        "LeoStream": {
            "Type": "AWS::DynamoDB::Table",
            "Properties": {
                "AttributeDefinitions": [
                    {
                        "AttributeName": "event",
                        "AttributeType": "S"
                    },
                    {
                        "AttributeName": "end",
                        "AttributeType": "S"
                    }
                ],
                "KeySchema": [
                    {
                        "AttributeName": "event",
                        "KeyType": "HASH"
                    },
                    {
                        "AttributeName": "end",
                        "KeyType": "RANGE"
                    }
                ],
                "ProvisionedThroughput": {
                    "ReadCapacityUnits": "20",
                    "WriteCapacityUnits": "20"
                }
            },
            "Metadata": {
                "AWS::CloudFormation::Designer": {
                    "id": "3ccf8004-ed2a-4bf9-b99c-c51e1a030939"
                }
            }
        },
        "LeoArchive": {
            "Type": "AWS::DynamoDB::Table",
            "Properties": {
                "AttributeDefinitions": [
                    {
                        "AttributeName": "event",
                        "AttributeType": "S"
                    },
                    {
                        "AttributeName": "end",
                        "AttributeType": "S"
                    }
                ],
                "KeySchema": [
                    {
                        "AttributeName": "event",
                        "KeyType": "HASH"
                    },
                    {
                        "AttributeName": "end",
                        "KeyType": "RANGE"
                    }
                ],
                "ProvisionedThroughput": {
                    "ReadCapacityUnits": "5",
                    "WriteCapacityUnits": "5"
                }
            },
            "Metadata": {
                "AWS::CloudFormation::Designer": {
                    "id": "29f59309-16b5-4651-9eaa-af8f92546b03"
                }
            }
        },
        "LeoEvent": {
            "Type": "AWS::DynamoDB::Table",
            "Properties": {
                "AttributeDefinitions": [
                    {
                        "AttributeName": "event",
                        "AttributeType": "S"
                    }
                ],
                "KeySchema": [
                    {
                        "AttributeName": "event",
                        "KeyType": "HASH"
                    }
                ],
                "ProvisionedThroughput": {
                    "ReadCapacityUnits": "5",
                    "WriteCapacityUnits": "5"
                },
                "StreamSpecification": {
                    "StreamViewType": "NEW_AND_OLD_IMAGES"
                }
            },
            "Metadata": {
                "AWS::CloudFormation::Designer": {
                    "id": "988eaa65-e07b-4c8a-b122-b4ecfd914c38"
                }
            }
        },
        "LeoSettings": {
            "Type": "AWS::DynamoDB::Table",
            "Properties": {
                "AttributeDefinitions": [
                    {
                        "AttributeName": "id",
                        "AttributeType": "S"
                    }
                ],
                "KeySchema": [
                    {
                        "AttributeName": "id",
                        "KeyType": "HASH"
                    }
                ],
                "ProvisionedThroughput": {
                    "ReadCapacityUnits": "5",
                    "WriteCapacityUnits": "5"
                }
            },
            "Metadata": {
                "AWS::CloudFormation::Designer": {
                    "id": "b4f0b5d1-e887-47ca-acd0-b6aecf4e5e70"
                }
            }
        },
        "LeoCron": {
            "Type": "AWS::DynamoDB::Table",
            "Properties": {
                "AttributeDefinitions": [
                    {
                        "AttributeName": "id",
                        "AttributeType": "S"
                    }
                ],
                "KeySchema": [
                    {
                        "AttributeName": "id",
                        "KeyType": "HASH"
                    }
                ],
                "ProvisionedThroughput": {
                    "ReadCapacityUnits": "20",
                    "WriteCapacityUnits": "20"
                },
                "StreamSpecification": {
                    "StreamViewType": "NEW_AND_OLD_IMAGES"
                }
            },
            "Metadata": {
                "AWS::CloudFormation::Designer": {
                    "id": "f236486a-1383-40dd-abd7-bdcf2cd304ea"
                }
            }
        },
        "LeoSystem": {
            "Type": "AWS::DynamoDB::Table",
            "Properties": {
                "AttributeDefinitions": [
                    {
                        "AttributeName": "id",
                        "AttributeType": "S"
                    }
                ],
                "KeySchema": [
                    {
                        "AttributeName": "id",
                        "KeyType": "HASH"
                    }
                ],
                "ProvisionedThroughput": {
                    "ReadCapacityUnits": "40",
                    "WriteCapacityUnits": "20"
                },
                "StreamSpecification": {
                    "StreamViewType": "NEW_AND_OLD_IMAGES"
                }
            },
            "Metadata": {
                "AWS::CloudFormation::Designer": {
                    "id": "5b164754-24d7-47f6-a6fb-2ce883e6c0b9"
                }
            }
        },
    }
}