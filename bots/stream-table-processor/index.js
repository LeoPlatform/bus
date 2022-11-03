"use strict";
const leo = require("leo-sdk");
const aws = require("aws-sdk");
const logger = require("leo-logger");
const DeleteBatchSize = 1000;

exports.handler = function (event, context, done) {

    // Group all deletes by Bucket
    let keysByBucket = {};
    event.Records.forEach(record => {
        // Only delete S3 file if the row is deleted and it has an S3 file associated
        if (record.dynamodb.NewImage == null) {
            const oldImage = record.dynamodb.OldImage && aws.DynamoDB.Converter.unmarshall(record.dynamodb.OldImage);
            if (oldImage.s3 != null && oldImage.s3.bucket && oldImage.s3.key) {
                if (!(oldImage.s3.bucket in keysByBucket)) {
                    keysByBucket[oldImage.s3.bucket] = [];
                }
                keysByBucket[oldImage.s3.bucket].push({ Key: oldImage.s3.key });
            }
        }
    });

    // Do the deletes in batches to not exceed the deleteObjects limit
    const allDeletes =  [];
    Object.keys(keysByBucket).forEach(bucket => {
        const keysToDelete = keysByBucket[bucket] || [];
        for (let i = 0; i < keysToDelete.length; i += DeleteBatchSize) {
            const deleteChunk = keysToDelete.slice(i, i + DeleteBatchSize);
            const chunkId = allDeletes.length + 1;
            allDeletes.push(leo.streams.s3.deleteObjects({
                Bucket: bucket,
                Delete: {
                    Objects: deleteChunk,
                    Quiet: false
                }
            }).promise().then(deleteResponse => {
                logger.log(`Delete Chunk ${chunkId} Response:`, bucket, deleteResponse);
                if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
                    logger.error(`Delete Chunk ${chunkId} Errors:`, JSON.stringify(deleteResponse.Errors, null, 2));
                    throw new Error("S3 Delete Objects Failed");
                }
            }));

            logger.log(`Delete Chunk ${chunkId}:`, deleteChunk);
        }
    });

    Promise.all(allDeletes).then(() => {
        logger.log("Deletes Successful");
        done();
    }).catch(err => {
        logger.log("Deletes Failed", err);
        done(err);
    });
};
