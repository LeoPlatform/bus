module.exports = {
    Parameters: {
        "StreamRecordsTtlSeconds": {
            "Type": "Number",
            "Default": 604800,
            "Description": "Number of seconds for LeoStream TTL. Events will be archived at TTL/2. Default is 604800 (# of seconds in a week)."
        },
        "StreamRecordsTtlEnabled": {
            "Type": "String",
            "Default": "Disabled",
            "AllowedValues": ["Disabled", "Enabled"],
            "Description": "Is TTL enabled for LeoStream dynamodb table."
        },
        "BusTag": {
            "Type": "String",
            "Description": "Bus Tag name",
            "MinLength": 1
        },
        "EnvironmentTag": {
            "Type": "String",
            "Description": "Environment Tag name",
            "MinLength": 1
        }
    },
    Conditions: {
        "IsStreamRecordsTtlEnabled": {
            "Fn::Equals": [{ "Ref": "StreamRecordsTtlEnabled" }, "Enabled"]
        }
    }
};
