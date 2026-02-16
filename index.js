import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
  GetCommand
} from "@aws-sdk/lib-dynamodb";
import crypto from "crypto";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME;

export const handler = async (event) => {
  console.log("Event:", JSON.stringify(event));

  // ✅ SAFE field extraction
  const field =
    event?.info?.fieldName ||
    event?.fieldName;

  if (field === "createNote") {
    const note = {
      noteId: crypto.randomUUID(),
      title: event.arguments.title,
      content: event.arguments.content,
      createdAt: new Date().toISOString()
    };

    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: note
      })
    );

    return note;
  }

  if (field === "getNotes") {
    const result = await ddb.send(
      new ScanCommand({ TableName: TABLE_NAME })
    );

    // ✅ Never return undefined to GraphQL
    return result.Items ?? [];
  }

  if (field === "getNote") {
    const result = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { noteId: event.arguments.noteId }
      })
    );

    return result.Item ?? null;
  }

  throw new Error(`Unknown field: ${field}`);
};