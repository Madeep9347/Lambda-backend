import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
  GetCommand
} from "@aws-sdk/lib-dynamodb";

import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

import crypto from "crypto";

// ===== Clients =====
const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const sqs = new SQSClient({});
const sns = new SNSClient({});

// ===== Environment Variables =====
const TABLE_NAME = process.env.TABLE_NAME;
const QUEUE_URL = process.env.QUEUE_URL;
const TOPIC_ARN = process.env.TOPIC_ARN;

export const handler = async (event) => {
  console.log("Incoming Event:", JSON.stringify(event));

  const field =
    event?.info?.fieldName ||
    event?.fieldName;

  // ===============================
  // CREATE NOTE
  // ===============================
  if (field === "createNote") {
    try {
      const note = {
        noteId: crypto.randomUUID(),
        title: event.arguments.title,
        content: event.arguments.content,
        createdAt: new Date().toISOString(),
        processed: false
      };

      // 1️⃣ Save to DynamoDB
      await ddb.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: note
        })
      );

      console.log("Note saved to DynamoDB");

      // 2️⃣ Send Message to SQS (Async processing)
      if (QUEUE_URL) {
        await sqs.send(
          new SendMessageCommand({
            QueueUrl: QUEUE_URL,
            MessageBody: JSON.stringify({
              eventType: "NOTE_CREATED",
              note
            })
          })
        );

        console.log("Message sent to SQS");
      }

      // 3️⃣ Publish Event to SNS (Notifications)
      if (TOPIC_ARN) {
        await sns.send(
          new PublishCommand({
            TopicArn: TOPIC_ARN,
            Message: JSON.stringify({
              eventType: "NOTE_CREATED",
              note
            })
          })
        );

        console.log("Event published to SNS");
      }

      return note;

    } catch (error) {
      console.error("Error creating note:", error);
      throw new Error("Failed to create note");
    }
  }

  // ===============================
  // GET ALL NOTES
  // ===============================
  if (field === "getNotes") {
    try {
      const result = await ddb.send(
        new ScanCommand({ TableName: TABLE_NAME })
      );

      return result.Items ?? [];
    } catch (error) {
      console.error("Error fetching notes:", error);
      throw new Error("Failed to fetch notes");
    }
  }

  // ===============================
  // GET SINGLE NOTE
  // ===============================
  if (field === "getNote") {
    try {
      const result = await ddb.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { noteId: event.arguments.noteId }
        })
      );

      return result.Item ?? null;
    } catch (error) {
      console.error("Error fetching note:", error);
      throw new Error("Failed to fetch note");
    }
  }

  throw new Error(`Unknown field: ${field}`);
};

