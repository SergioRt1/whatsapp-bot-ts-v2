import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { PutCommand, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = process.env.DYNAMODB_TABLE!;
if (!TABLE_NAME) {
    throw new Error('Environment variable TABLE_NAME must be defined');
}
const dynamoClient = new DynamoDBClient({ region: 'us-east-2' });

/**
 * Constructs parameters for putting an item into DynamoDB.
 */
function buildPutParams(id: string, data: string) {
    return {
        TableName: TABLE_NAME,
        Item: { id, data }
    };
}

/**
 * Stores a string in DynamoDB under the specified ID.
 */
export async function putDocument(id: string, data: string): Promise<void> {
    const params = buildPutParams(id, data);
    try {
        const result = await dynamoClient.send(new PutCommand(params));
        if (result.$metadata.httpStatusCode === 200) {
            console.log(`✅ Stored item with ID: ${id}`);
        } else {
            console.error(`❌ Failed to store item (${id}):`, result);
        }
    } catch (error) {
        console.error(`❌ Error storing item (${id}):`, error);
    }
}

/**
 * Constructs parameters for retrieving an item from DynamoDB.
 */
function buildGetParams(id: string) {
    return {
        TableName: TABLE_NAME,
        Key: { id }
    };
}

/**
 * Retrieves a string item by ID from DynamoDB.
 * @returns The stored string or null if not found or on error.
 */
export async function getDocument(id: string): Promise<string | null> {
    const params = buildGetParams(id);
    try {
        const result = await dynamoClient.send(new GetCommand(params));
        if (result.$metadata.httpStatusCode === 200 && result.Item?.data) {
            console.log(`✅ Item fetched: ${id}`);
            return result.Item.data as string;
        } else {
            console.warn(`⚠️ Item not found or has no data: ${id}`);
        }
    } catch (error) {
        console.error(`❌ Error retrieving item (${id}):`, error);
    }
    return null;
}

/**
 * Constructs parameters for deleting an item from DynamoDB.
 */
function buildDeleteParams(id: string) {
    return {
        TableName: TABLE_NAME,
        Key: { id }
    };
}

/**
 * Deletes an item by ID from DynamoDB.
 */
export async function deleteDocument(id: string): Promise<void> {
    const params = buildDeleteParams(id);
    try {
        const result = await dynamoClient.send(new DeleteCommand(params));
        if (result.$metadata.httpStatusCode === 200) {
            console.log(`✅ Deleted item with ID: ${id}`);
        } else {
            console.error(`❌ Failed to delete item (${id}):`, result);
        }
    } catch (error) {
        console.error(`❌ Error deleting item (${id}):`, error);
    }
}
